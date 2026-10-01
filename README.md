# Vernietigingscockpit-code
Codebase voor de vernietigingscockpit, monorepo frontend en backend

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

Vul in `.env` minimaal `DATABASE_URL` met de PostgreSQL-verbinding. `PRISMA_GENERATE_DATABASE_URL` is alleen nodig tijdens `docker compose build` voor `prisma generate` en mag een niet-bestaande, syntactisch geldige PostgreSQL-URL zijn. Alle publieke URLs, OIDC URLs, API-base-URL en healthcheck-URLs staan in `.env`; `compose.yaml` en `Dockerfile` bevatten daarvoor geen vaste URL-defaults. Traefik moet al draaien op het externe Docker-netwerk uit `TRAEFIK_NETWORK` (`traefik` standaard). De webconfiguratie (`WEB_*`) wordt tijdens `docker compose build` in de Vite-bundel gezet; rebuild de web-image na wijzigingen in die waarden.
