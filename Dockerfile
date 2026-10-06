FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/cockpit-api/package.json apps/cockpit-api/package.json
COPY apps/cockpit-web/package.json apps/cockpit-web/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY packages/stekker-client/package.json packages/stekker-client/package.json

RUN npm ci

FROM deps AS cockpit-api-build

ARG PRISMA_GENERATE_DATABASE_URL

COPY packages/api-contract packages/api-contract
COPY packages/stekker-client packages/stekker-client
COPY apps/cockpit-api apps/cockpit-api

# Het gedeelde contract (CC-19) eerst bouwen; de stekkertypes zijn alleen nodig bij het compileren.
RUN npm run build --workspace @vernietigingscockpit/api-contract

WORKDIR /app/apps/cockpit-api

RUN DATABASE_URL="${PRISMA_GENERATE_DATABASE_URL}" npm run db:generate
RUN npm run build

# Alleen de runtime-dependencies van de API (CC-14): zonder devDependencies en zonder
# optionele dependencies en peers (de Prisma CLI en TypeScript komen als optionele peer
# van @prisma/client mee en zijn in de lockfile "devOptional").
# Alle peers die de API nodig heeft, staan als gewone dependency in package.json.
FROM node:22-alpine AS cockpit-api-prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/cockpit-api/package.json apps/cockpit-api/package.json
COPY apps/cockpit-web/package.json apps/cockpit-web/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY packages/stekker-client/package.json packages/stekker-client/package.json

RUN npm ci --omit=dev --omit=optional --omit=peer --workspace @vernietigingscockpit/cockpit-api --include-workspace-root=false \
  && mkdir -p apps/cockpit-api/node_modules

# Eenmalige migratiejob (CC-14): migraties en de loginrol van de API, als eigenaar van de
# database. Bevat de Prisma CLI; draait niet als langlopende service.
FROM cockpit-api-build AS cockpit-migrate

ENV NODE_ENV=production

USER node

CMD ["sh", "-c", "node /app/node_modules/prisma/build/index.js migrate deploy && if [ -n \"$APP_DB_USER\" ]; then node scripts/db-app-gebruiker.mjs; fi"]

# API en worker (zelfde image, ander startcommando).
FROM node:22-alpine AS cockpit-api

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
COPY apps/cockpit-api/package.json apps/cockpit-api/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY --from=cockpit-api-build /app/packages/api-contract/dist ./packages/api-contract/dist
COPY --from=cockpit-api-prod-deps /app/node_modules ./node_modules
COPY --from=cockpit-api-prod-deps /app/apps/cockpit-api/node_modules ./apps/cockpit-api/node_modules
# De gegenereerde Prisma-client (uit `prisma generate` in de build-stage).
COPY --from=cockpit-api-build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=cockpit-api-build /app/apps/cockpit-api/dist ./apps/cockpit-api/dist

WORKDIR /app/apps/cockpit-api

# Archiefmap voor de worker (CC-18); een volume op dit pad neemt de eigenaar over.
RUN mkdir -p /archief && chown node:node /archief

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]

FROM deps AS cockpit-web-build

ARG VITE_AUTH_ENABLED=true
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_POST_LOGOUT_REDIRECT_URI
ARG VITE_OIDC_SCOPE
ARG VITE_API_BASE_URL

ENV VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED}
ENV VITE_OIDC_AUTHORITY=${VITE_OIDC_AUTHORITY}
ENV VITE_OIDC_CLIENT_ID=${VITE_OIDC_CLIENT_ID}
ENV VITE_OIDC_REDIRECT_URI=${VITE_OIDC_REDIRECT_URI}
ENV VITE_OIDC_POST_LOGOUT_REDIRECT_URI=${VITE_OIDC_POST_LOGOUT_REDIRECT_URI}
ENV VITE_OIDC_SCOPE=${VITE_OIDC_SCOPE}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# De web-app gebruikt alleen de types uit het contract (CC-19).
COPY packages/api-contract packages/api-contract
COPY apps/cockpit-web apps/cockpit-web

WORKDIR /app/apps/cockpit-web

RUN npm run build

# Draait als niet-root gebruiker (CC-14); luistert op 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS cockpit-web

# De nginx-configuratie (met CSP) wordt bij het starten gemaakt uit dit template.
COPY apps/cockpit-web/nginx.conf.template /etc/nginx/cockpit/default.conf.template
COPY --chmod=755 apps/cockpit-web/docker/40-cockpit-csp.sh /docker-entrypoint.d/40-cockpit-csp.sh
COPY --from=cockpit-web-build /app/apps/cockpit-web/dist /usr/share/nginx/html

EXPOSE 8080
