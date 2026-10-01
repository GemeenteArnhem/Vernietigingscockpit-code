# F1 contractharmonisatie – afronding

Datum: 2026-09-29

## Doel

F1 harmoniseert de kernbegrippen, statussen, endpoints en repository-indeling tussen:

- `Vernietigingscockpit`
- `Vernietigingscockpit-code`
- `Vernietigingscockpit-stekker-test`

De fase maakt nog geen werkende backend. Het doel is dat architectuur, UI-spec, mockup-code en teststekker-backlog dezelfde contracttaal gebruiken.

## Vastgelegde besluiten

- ADR 0002 legt I-1 t/m I-9 vast.
- Canonieke workflowstatussen: `init`, `beoordeling`, `accordering_po`, `accordering_archivaris`, `vrijgegeven`, `uitvoering`, `resultaat`, `archief`.
- Uitvoeringsresultaten volgen de OpenAPI-enum: `SUCCESS`, `FAILED`, `SKIPPED`, `NOT_FOUND`, `CHANGED`.
- De uitwisseleenheid heet `vernietigingskandidaat`.
- API- en UI-velden gebruiken `aantalObjecten` en `aantalBetrokkenen`.
- De beoordeling wordt voorgelegd via `POST /taken/{id}/beoordeling/voorleggen`.
- De recordmanager start technische vernietiging via `POST /taken/{id}/vernietigingsopdracht`.
- De webapp staat onder `apps/cockpit-web` en wordt via npm workspaces gebouwd.
- Tailwind 3.4 blijft voorlopig canoniek.

## Uitgevoerd

### Architectuurrepo

- `architectuur/adr/0002-adr-contractharmonisatie-cockpit.md` toegevoegd.
- `architectuur/architectuur-techniek.md` bijgewerkt naar `vernietigingskandidaat`, canonieke workflowstatussen en OpenAPI-resultaatwaarden.
- UI-spec state machine uitgebreid met `vrijgegeven`.
- UI-spec API-mapping bijgewerkt voor `voorleggen` en `vernietigingsopdracht`.
- UI-spec labels bijgewerkt van "Door naar accordering" naar "Voorleggen".

### Code-repo

- `ui/` verplaatst naar `apps/cockpit-web/`.
- Root `package.json` ingericht met workspaces en scripts.
- Root `package-lock.json` bijgewerkt voor de workspace.
- Geneste webapp-lockfile verwijderd.
- Mockup-types en mockdata bijgewerkt naar `VernietigingsKandidaat`, `aantalObjecten`, `aantalBetrokkenen`.
- Resultaattypes en resultaatmockdata bijgewerkt naar `SUCCESS`, `FAILED`, `SKIPPED`, `NOT_FOUND`, `CHANGED`.
- Bouwplan bijgewerkt met de nieuwe paden en endpointnaam.

### Teststekkerrepo

- `backlog/` toegevoegd met S-1 t/m S-8 als uitgewerkte backlog-items.
- De backlog dekt batchresultaat-endpoints, `PARTIAL`, optionele JWT-validatie, idempotency, scenario-configuratie, tweede instantie, Docker/health en sequence-test.

## Controle

Uitgevoerd:

- `npm run build` in `Vernietigingscockpit-code`
- `npm test` in `Vernietigingscockpit-stekker-test`
- zoekcontrole op oude termen/endpoints:
  - `VernietigingsObject`
  - `vernietigingsobject`
  - `omvangDocumenten`
  - `omvangClienten`
  - `Door naar accordering`
  - `/taken/{id}/indienen`
  - `GEWIJZIGD`
  - `AANGEMAAKT`
  - `AFGEROND`
  - `POST /taken/{id}/uitvoering`
  - `ui/src`

## Bewuste resthits

- Het bouwplan bevat oude termen nog in paragraaf 1.3 als beschrijving van de oorspronkelijke inconsistenties.
- ADR 0002 bevat oude termen als verworpen alternatieven.
- De teststekker gebruikt intern de bronstatus `GEWIJZIGD`, maar rapporteert naar buiten `CHANGED`. Dit is acceptabel zolang het externe API-resultaat de OpenAPI-enum volgt.
- Bestaande backlog-story `US-025` gebruikt nog "vernietigingsobjecten" in vrije tekst. Dit is geen contractbron voor F1, maar kan later redactioneel worden aangepast.

## Klaar voor

F1 is inhoudelijk klaar om door te gaan naar:

- F2: inloggen en workflowbasis.
- F3: database, stamgegevens en basiscontrollers.
- F4: stekkerbeheer en selectie.

De teststekker-backlog S-1 t/m S-8 kan parallel worden opgepakt voordat F4 volledig wordt gebouwd.
