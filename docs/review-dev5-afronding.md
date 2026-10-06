# Review dev5 - afronding

Datum: 2026-10-04

## Doel

Deze reeks verwerkt de actielijst uit de codereview van branch `dev5` (`actielijst-cockpit-code.md`, CC-1 t/m CC-18 en CC-21). Het werk ging stap voor stap. Bij elke stap zijn de keuzes aan de product owner voorgelegd. Zichtbare UI-wijzigingen zijn alleen gedaan na akkoord.

## Resultaat per stap

| Stap | Pakket | Wat is er veranderd |
|---|---|---|
| 1 | CC-1 Testfundament en CI | Vitest-projecten `unit`, `integratie` (Testcontainers) en `e2e` (`scripts/e2e.mjs` met `infrastructure/compose/docker-compose.test.yml` en de vastgepinde teststekker); CI in `.github/workflows/ci.yml`. |
| 2 | CC-2 Retrybeleid | `worker/retrybeleid.ts`: alleen 5xx, time-outs en netwerkfouten opnieuw, met exponentiële backoff tot `WORKER_MAX_POGINGEN`; 4xx direct vastgelegd; daarna "opnieuw proberen" via de cockpit. |
| 3 | CC-3 Stekkerclient | Eén client (`modules/stekker/`) met OAuth2 client credentials, time-outs per verbinding, strikte contractcontrole, `X-Correlation-ID` en `Idempotency-Key`. |
| 4 | CC-4 Functiescheiding | Recordmanager, proceseigenaar en archivaris zijn drie verschillende personen, op de taakdefinitie en de taakinstantie (database-check + servicecontrole). |
| 5 | CC-5 WorkflowService | Eén plek voor statusovergangen (`workflow/transitions.ts`, `WorkflowService.transition()`); `versie` met `ETag`/`If-Match` verplicht; 428/412/409/404/403/400; `toegestaneActies` uit de API. |
| 6 | CC-6 Auditketen | Hashketen per taak; actienamen uit `audit-event-model.md` + concept-ADR-0003; aparte applicatierol met alleen `SELECT`/`INSERT` op de audittabellen; auditlog en verificatie-endpoint voor betrokkenen en auditor. |
| 7 | CC-7 Worker | Eigen proces (`dist/worker.js`, service `cockpit-worker`); jobs in een Postgres-outbox, geclaimd met `FOR UPDATE SKIP LOCKED` en een lease. |
| 8 | CC-8 Uitvoering | Vernietiging in stappen (start, batches, vrijgeven, poll, resultaten) met eigen vastlegging (`vernietiging`, `vernietiging_batch`, `uitvoeringsresultaat`), idempotente herhaling en integriteitscontrole. |
| 9 | CC-16 Selectie robuuster | Pollfouten volgens het retrybeleid; time-out per selectie (standaard 24 uur, `timeouts.selectieMs`); herkansen maakt een nieuw selectierecord, het oude wordt `VERVANGEN`. |
| 10 | CC-11/12/14/15 Hardening | zod-validatie, helmet, rate limits, `RolesGuard` standaard weigeren; identiteit op `sub` (`USER_LINKED`); migratie-image `cockpit-migrate`, `timestamptz`, runtime als `node`; pino-JSON-logging met `correlatie_id`. |
| 11 | CC-13 Web-hardening | Tokens in `sessionStorage`, stille vernieuwing bij 401; `ConfirmDialog` vóór de vernietigingsopdracht; 409/412-melding met "Opnieuw laden"; nginx-unprivileged met CSP uit env. |
| 12 | CC-9 Accorderingsmodel (beperkt) | Besluiten van PO en archivaris per kandidaat in `kandidaat_besluit` (append-only); `lijst_hash` bij de vrijgave door de archivaris; afwijkende lijst → 409 + `EXECUTION_FAILED` (`LIST_CHANGED`). |
| 13 | CC-10 Paginering en bulk | Server-side paginering, zoeken, filteren, sorteren en facetten; endpoints voor id's, samenvatting en bulkbeoordeling; tabellen met hetzelfde uiterlijk. |
| 14 | CC-17 Verklaring | De worker maakt de vernietigingsverklaring automatisch bij de overgang naar `resultaat` (PDF/A-2b via Gotenberg, met CSV-bijlage); opnieuw maken is een beheeractie. |
| 15 | CC-18 Archivering | Recordmanager vraagt archiveren aan; de worker zet verklaring, CSV-bijlage, auditlog en `manifest.json` (SHA-256 per bestand) weg via `BestandArchiefAdapter` en de taak gaat naar `archief`. |
| 16 | CC-21 Repo-hygiëne | Seed-stekker standaard op poort 3100 (geen botsing met de API); `AGENTS.md` aangepast aan de huidige code; dit document. |
| 17 | CC-20 Opsplitsen | `taken.service.ts` (1.843 regels) gesplitst in `TaakToegangService`, `SelectieService`, `BeoordelingService`, `BesluitvormingService`, `UitvoeringService` en `DossierService` plus `taken-hulp.ts`; alle controllers zonder Prisma (nieuw: `StekkersService`). Geen functionele wijziging. |
| 18 | CC-19 Contract | `packages/stekker-client`: types gegenereerd (openapi-typescript) uit de stekkerspec in de architectuurrepo, gebruikt door de eigen client; CI controleert dat ze bij de spec passen. `packages/api-contract`: zod-invoerschema's, rollen en antwoordtypes, gedeeld door API (returntypes van de services) en web-app (vervangt de eigen `Api*`-types). |
| 19 | E2E-scenario's F en G | F (hangende stekker, `stekker-hangt`): selectie en uitvoering lopen na de nieuwe pogingen vast met een time-outmelding; herkansen en opnieuw proberen ronden af zonder dubbel werk. G (afwijkende resultaten, `stekker-afwijkend`): per kandidaat het gemelde resultaat, aantallen per uitkomst in uitvoering, audit, verklaring en CSV, archiveren kan. Bevinding uit F: een stap die langer duurde dan de lease werd door workers eindeloos overgenomen (livelock); opgelost met leaseverlenging rond elke externe aanroep (`verlengClaim`/`metLease`), met integratietest. |

## Genomen besluiten

- **B-A (jobs):** eigen Postgres-outbox in plaats van BullMQ/Redis; worker als eigen container; lease standaard 5 minuten.
- **B-B (Idempotency-Key):** verplicht op alle POST's naar de stekker, ook `POST /selecties` (concept-ADR-0004, spec v1.1).
- **B-C (functiescheiding):** RM ≠ PO, naast de bestaande regels voor de archivaris.
- **B-E (accordering):** de huidige werking blijft. PO en archivaris kiezen per kandidaat Akkoord of Retour; één Retour stuurt de hele lijst terug naar de recordmanager, met de beoordelingen en opmerkingen. Geen lijstbesluit en geen aanpassing van de accorderingsschermen.
- **B-F (auditeventset):** actienamen uit de spec, aangevuld in concept-ADR-0003 (onder meer `USER_LINKED`, `ARCHIVING_REQUESTED`, `ARCHIVING_FAILED`).
- Bestaande auditdata: de nieuwe auditketen begint met een lege database (alleen testdata).
- Toegang zonder betrokkenheid bij een taak geeft 404; 412 gaat vóór 409.
- Selectie: time-out 24 uur; herkansen met `VERVANGEN` + `vervangen_door_id`.
- Identiteit: automatisch koppelen bij de eerste login (op gebruikersnaam of geverifieerd e-mailadres), daarna alleen op `sub`.
- Rate limit: 300 per minuut per gebruiker, 60 per minuut per IP voor anonieme endpoints.
- Verklaring: alleen automatisch; de knop "Verklaring genereren" is vervallen; de voorbeeld-PDF is goedgekeurd.
- Archivering: actie "Archiveren" voor de recordmanager op de resultaatpagina ("Opnieuw archiveren" na een fout); nu alleen een map op een volume, Open Zaak later via dezelfde interface.

## Nieuwe endpoints (selectie)

- `GET /taken/:id/auditlog`, `GET /taken/:id/auditlog/verificatie`
- `GET /taken/:id/kandidaten` (gepagineerd), `GET /taken/:id/kandidaten/ids`, `POST /taken/:id/kandidaten/samenvatting`
- `PATCH /taken/:id/kandidaten` en `PATCH /taken/:id/kandidaten/accordering/{proceseigenaar,archivaris}` (bulk)
- `GET /taken/:id/uitvoering`, `POST /taken/:id/uitvoering/:stekkerId/opnieuw`
- `GET /taken/:id/verklaring`, `GET /taken/:id/verklaring.pdf`, `GET /taken/:id/verklaring/bijlage.csv`, `POST /taken/:id/verklaring/opnieuw` (functioneel beheerder)
- `POST /taken/:id/archiveren` (202, `If-Match`), `GET /taken/:id/archivering`

Alle muterende endpoints op een taak vereisen `If-Match`.

## Configuratie

Nieuw of gewijzigd in `.env.example`:

- Database: `MIGRATE_DATABASE_URL`, `APP_DB_USER`, `APP_DB_PASSWORD`, `sslmode=require`.
- Worker: `WORKER_LEASE_MS`, `WORKER_POLL_START_MS`, `WORKER_POLL_MAX_MS` (daarnaast optioneel `WORKER_ID`, `WORKER_MAX_POGINGEN`, `WORKER_BACKOFF_START_MS`, `WORKER_BACKOFF_MAX_MS`).
- Gotenberg (`GOTENBERG_*`) en `ARCHIEF_PAD` gelden voor de worker, niet voor de API.
- Hardening: `RATE_LIMIT_GEBRUIKER_PER_MINUUT`, `RATE_LIMIT_ANONIEM_PER_MINUUT`, `TRUST_PROXY`, `LOG_LEVEL`.
- Web: `WEB_OIDC_AUTHORITY` en `WEB_API_BASE_URL` bepalen ook de CSP.
- Seed: `SEED_STEKKER_BASE_URL` standaard `http://localhost:3100`.

Voor de VM:

- Neem het volume `archief` (`cockpit-archief`) op in de back-up.
- De migratie `20261002140000_audit_keten_app_rol` stopt als er al audit-events zijn.

## Tests

Bij de afronding van stap 15 zijn groen:

- typecheck en lint;
- 148 unit-tests en 87 integratietests;
- de build;
- 13 E2E-tests (twee workers, worker-kill tijdens de uitvoering, grote lijst, echte Gotenberg, archivering).

Na stap 19: 148 unit-tests, 88 integratietests en 16 E2E-tests (met scenario's F en G).

## Open punten

- Concept-ADR-0003 (auditeventset) en concept-ADR-0004 (Idempotency-Key, spec v1.1) staan in de architectuurrepo en moeten nog worden vastgesteld (`TODO(B-F)` in `audit-acties.ts`).
- `OpenZaakArchiefAdapter` achter de bestaande `ArchiefAdapter`-interface.
- UI-tests met Playwright en axe.
- Prisma-schema gelijktrekken met de migraties (er is al bestaande drift).
