# Vernietigingscockpit-code
Codebase voor de vernietigingscockpit, monorepo frontend en backend

## Acceptatieomgeving (lokaal)

Volledige omgeving met Keycloak, teststekker en testaccounts om zelf te testen: zie [infrastructure/acceptatie/README.md](infrastructure/acceptatie/README.md).

## Gedeelde pakketten

- `packages/api-contract`: zod-invoerschema's, rollen en antwoordtypes, gedeeld door `cockpit-api` en `cockpit-web`. `npm run build` bouwt dit pakket eerst; in ontwikkeling en tests wordt de TypeScript-bron direct gebruikt.
- `packages/stekker-client`: TypeScript-types van de Stekker-API, gegenereerd uit `designrules/api/stekker-openapi-spec.yaml` in de architectuurrepo. Die repo staat naast deze repo, of geef het pad op met `STEKKER_SPEC`.

```bash
npm run generate --workspace @vernietigingscockpit/stekker-client
```

`npm run check:generated --workspace @vernietigingscockpit/stekker-client` controleert of de types nog bij de spec passen (ook in CI).

## Docker compose

De root `compose.yaml` bouwt twee containers:

- `cockpit-web`: Vite build, geserveerd met nginx op `https://cockpit.arnhem.dev`.
- `cockpit-api`: NestJS API op `https://api.cockpit.arnhem.dev`.

Gebruik:

```powershell
Copy-Item .env.example .env
docker compose build
docker compose up -d
```

Vul in `.env` minimaal `DATABASE_URL` met de PostgreSQL-verbinding. De API-container wordt gekoppeld aan het externe Docker-netwerk uit `DATABASE_NETWORK` (`intern` standaard), zodat PostgreSQL intern bereikbaar is via bijvoorbeeld `postgres:5432`. `PRISMA_GENERATE_DATABASE_URL` is alleen nodig tijdens `docker compose build` voor `prisma generate` en mag een niet-bestaande, syntactisch geldige PostgreSQL-URL zijn. Alle publieke URLs, OIDC URLs, API-base-URL en healthcheck-URLs staan in `.env`; `compose.yaml` en `Dockerfile` bevatten daarvoor geen vaste URL-defaults. Traefik moet al draaien op het externe Docker-netwerk uit `TRAEFIK_NETWORK` (`traefik` standaard). De webconfiguratie (`WEB_*`) wordt tijdens `docker compose build` in de Vite-bundel gezet; rebuild de web-image na wijzigingen in die waarden.

### Database: migraties en applicatierol

De API verbindt niet als eigenaar van de database, maar als een aparte loginrol (`APP_DB_USER`) die lid is van `<database>_app`. Die rol mag op `audit_event` en `configuratie_event` alleen lezen en toevoegen (ADR-0003).

Migraties draaien automatisch: `docker compose up` start eerst de eenmalige service `cockpit-migrate` (eigen image met de Prisma CLI). Die voert `prisma migrate deploy` uit als eigenaar (`MIGRATE_DATABASE_URL`, met recht om rollen te maken) en maakt of werkt de loginrol `APP_DB_USER` bij. De API en de worker starten pas als dat gelukt is. De API-image bevat geen devDependencies en draait als gebruiker `node`.

```bash
docker compose up -d --build
```

Seed (eenmalig, testgegevens) via dezelfde migratie-image:

```bash
docker compose run --rm cockpit-migrate npm run db:seed
```

De seed koppelt de teststekker op `SEED_STEKKER_BASE_URL` (standaard `http://localhost:3100`; de API gebruikt 3000). Start de teststekker lokaal dus met `PORT=3100`. Met `SEED_STEKKER_AUTH_TYPE=oauth2_cc` komen `SEED_STEKKER_TOKEN_URL`, `SEED_STEKKER_CLIENT_ID` en het secret (via `SEED_STEKKER_SECRET_REF`) ook uit env.

`DATABASE_URL` in `.env` gebruikt `APP_DB_USER` en `APP_DB_PASSWORD`. De migratie `20261002140000_audit_keten_app_rol` stopt als er al audit-events zijn: de nieuwe auditketen begint met een lege database.
