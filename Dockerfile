FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/cockpit-api/package.json apps/cockpit-api/package.json
COPY apps/cockpit-web/package.json apps/cockpit-web/package.json

RUN npm ci

FROM deps AS cockpit-api-build

ARG PRISMA_GENERATE_DATABASE_URL

COPY apps/cockpit-api apps/cockpit-api

WORKDIR /app/apps/cockpit-api

RUN DATABASE_URL="${PRISMA_GENERATE_DATABASE_URL}" npm run db:generate
RUN npm run build

FROM node:22-alpine AS cockpit-api

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY apps/cockpit-api/package.json apps/cockpit-api/package.json
COPY --from=cockpit-api-build /app/node_modules ./node_modules
COPY --from=cockpit-api-build /app/apps/cockpit-api/dist ./apps/cockpit-api/dist
COPY --from=cockpit-api-build /app/apps/cockpit-api/prisma ./apps/cockpit-api/prisma
COPY --from=cockpit-api-build /app/apps/cockpit-api/prisma.config.ts ./apps/cockpit-api/prisma.config.ts

WORKDIR /app/apps/cockpit-api

EXPOSE 3000

CMD ["npm", "start"]

FROM deps AS cockpit-web-build

ARG VITE_AUTH_ENABLED=false
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

COPY apps/cockpit-web apps/cockpit-web

WORKDIR /app/apps/cockpit-web

RUN npm run build

FROM nginx:1.29-alpine AS cockpit-web

COPY apps/cockpit-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=cockpit-web-build /app/apps/cockpit-web/dist /usr/share/nginx/html

EXPOSE 8080
