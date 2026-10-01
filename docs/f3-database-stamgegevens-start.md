# F3 database, stamgegevens en basiscontrollers - start

Datum: 2026-09-29

## Doel

F3 brengt de cockpit van mockdata naar databasegestuurde stamgegevens, taakdefinities en taken.

## Eerste increment

- Prisma-schema toegevoegd voor de F3-basistabellen:
  - `afdeling`
  - `medewerker`
  - `gebruiker`
  - `stekker`
  - `stekker_configuratie`
  - `taakdefinitie`
  - `taakdefinitie_stekker`
  - `taakinstantie`
  - `selectie`
  - `audit_event`
  - `configuratie_event`
  - `outbox`
- Eerste SQL-migratie toegevoegd met append-only triggers voor `audit_event` en `configuratie_event`.
- Seed-script toegevoegd met dev-stamgegevens voor de testrollen en een eerste taakdefinitie.
- `DATABASE_URL` toegevoegd aan de API `.env.example`.
- Prisma dependencies voorbereid in `apps/cockpit-api/package.json` en exact vastgezet op `7.10.0`.
- API-configuratie leest nu ook `apps/cockpit-api/.env.local`.
- Lokale, genegeerde `apps/cockpit-api/.env.local` toegevoegd met `db.cockpit.arnhem.dev` als databasehost.
- Prisma client-generatie werkt met Prisma 7-configuratie via `apps/cockpit-api/prisma.config.ts`.
- Prisma runtime gebruikt `@prisma/adapter-pg`, zoals Prisma 7 vereist.
- De eerste seed met dev-stamgegevens en een taakdefinitie is uitgevoerd.
- Read-only API-controllers toegevoegd voor:
  - `GET /api/v1/stamgegevens/afdelingen`
  - `GET /api/v1/stamgegevens/medewerkers`
  - `GET /api/v1/taakdefinities`
  - `GET /api/v1/taakdefinities/:id`
  - `GET /api/v1/taken`
  - `GET /api/v1/taken/:id`

## Nog te doen

- Prisma dependencies installeren zodra npm netwerktoegang normaal doorloopt.
- `DATABASE_URL` aanvullen met de echte PostgreSQL-gebruiker, wachtwoord en databasenaam.
- Dashboard en taakdefinitie-detail stap voor stap laten lezen uit deze API-data.
- Nest database module aansluiten op de gegenereerde Prisma client.
- Read-only controllers toevoegen voor stamgegevens, taakdefinities en taken.
- Dashboard en taakdefinitie-detail stap voor stap laten lezen uit de API.

## Let op

De dependency-installatie voor Prisma bleef in deze sessie hangen na netwerktoegang. Een afgebroken poging heeft de lokaal deels aanwezige Prisma-installatie verwijderd. Daarom is de F3-databasebasis alvast als schema, migratie en seed vastgelegd, zonder runtime-import in de API-modules.

## Runbook zodra npm-installatie lukt

```powershell
npm install --offline=false
npm run db:generate --workspace @vernietigingscockpit/cockpit-api
npm run db:deploy --workspace @vernietigingscockpit/cockpit-api
npm run db:seed --workspace @vernietigingscockpit/cockpit-api
```

Daarna kunnen de Nest database module en read-only controllers voor stamgegevens, taakdefinities en taken worden aangesloten.

## Controle 2026-09-29

- `npm install --offline=false` is geslaagd nadat bleek dat npm lokaal op `offline=true` stond.
- `npm run db:generate --workspace @vernietigingscockpit/cockpit-api` is geslaagd.
- `npm run db:deploy --workspace @vernietigingscockpit/cockpit-api` is geslaagd via poort 443.
- `npm run db:seed --workspace @vernietigingscockpit/cockpit-api` is geslaagd.
- API-start registreert de nieuwe stamgegevens-, taakdefinitie- en takenroutes.
- Een request zonder token op `GET /api/v1/stamgegevens/afdelingen` geeft `401 Unauthorized`.
- Dashboard en taakdefinitie-detail halen nu data op uit de F3 API zodra er een access token is.
- De webapp valt tijdens ontwikkelwerk terug op mockdata als de API-call faalt.
- `npm run build` is groen na de webkoppeling.
- API-controllers geven nu expliciete DTO's terug in plaats van rauwe Prisma-includes.
- De F3 API-response groepeert verantwoordelijken, stekkers, instanties en tellingen in een stabieler cockpit-contract.
- `GET /api/v1/me` synchroniseert de ingelogde Keycloak-gebruiker nu naar de tabel `gebruiker`.
- `/me` koppelt de gebruiker waar mogelijk aan `medewerker` via `preferred_username`/`extern_id` en daarna via e-mail.
- Controllers gebruiken expliciete Nest-injectie voor database-afhankelijkheden, passend bij de ESM/tsx-runtime.
- `GET /api/v1/taken` ondersteunt `scope=mijn|alle` en filtert standaard op de gekoppelde medewerker.
- `GET /api/v1/taakdefinities` ondersteunt `scope=mijn|alle` en filtert standaard op de gekoppelde medewerker.
- De dashboardtab wisselt nu tussen `scope=mijn` en `scope=alle`.
- Detail-endpoints voor taken en taakdefinities gebruiken dezelfde medewerkerfiltering als de lijsten.
- Dashboardnavigatie gebruikt bij API-data nu het taakdefinitie-id en taakinstantie-id apart.
- Detail-endpoints behouden het alles-lezen recht voor `auditor` en, bij taakdefinities, `functioneel_beheerder`.
- `POST /api/v1/taakdefinities` toegevoegd voor recordmanagers.
- Taakdefinitie-aanmaak valideert verplichte velden, frequentie, startmaand, medewerkerrollen en functiescheiding.
- Taakdefinitie-aanmaak schrijft binnen dezelfde transactie een append-only `configuratie_event`.
- `POST /api/v1/taakdefinities/:id/instanties` toegevoegd voor recordmanagers.
- Taakinstantie-aanmaak maakt een instantie in status `init` met snapshots van recordmanager, proceseigenaar en archivaris.
- Taakinstantie-aanmaak schrijft binnen dezelfde transactie een append-only `configuratie_event`.
- API-responses voor taakdefinities en taakinstanties bevatten nu `toegestaneActies`.
- `toegestaneActies` wordt backend-side berekend uit rol, gekoppelde medewerker en workflowstatus.
- Dashboard en taakdefinitie-detail gebruiken `toegestaneActies` voor API-data om actiepanelen te bepalen.
- Taakdefinitie-detail kan via `toegestaneActies` nu een nieuwe taakinstantie aanmaken met `POST /api/v1/taakdefinities/:id/instanties` en navigeert daarna naar de nieuwe uitvoering.
- `POST /api/v1/stamgegevens/import` toegevoegd voor functioneel beheerders.
- Stamgegevens-import upsert afdelingen op `code` en medewerkers op `email`.
- Stamgegevens-import valideert rollen en schrijft een append-only `configuratie_event`.
- Publieke health endpoints toegevoegd:
  - `GET /api/v1/health` controleert of de API leeft.
  - `GET /api/v1/health/ready` controleert de databaseverbinding met een Prisma `SELECT 1`.
- Database-readiness is na container recreate groen getest tegen de Docker/API-runtime.
- Frontend-flow is handmatig gecontroleerd: vanuit een taakdefinitie wordt een nieuwe taakuitvoering aangemaakt en de UI navigeert naar die nieuwe taakuitvoering.
- `GET /api/v1/stekkers` toegevoegd voor actieve stekkers met laatste configuratie, zodat taakdefinitie-aanmaak echte stekkerdata kan gebruiken.
- Frontendroute `/taak/nieuw` toegevoegd voor het aanmaken van taakdefinities via de cockpit.
- Het formulier gebruikt echte stamgegevens voor recordmanager, proceseigenaar, archivaris en actieve stekkers, slaat op via `POST /api/v1/taakdefinities` en navigeert daarna naar de nieuwe taakdefinitie.
