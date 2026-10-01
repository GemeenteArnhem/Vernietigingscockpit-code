# F4 stekkerbeheer en selectie - start

Datum: 2026-09-30

## Doel

F4 brengt de cockpit van taakdefinitie en taakuitvoering naar de eerste echte selectiestap: een recordmanager kan vanuit een taakuitvoering selectie-aanvragen klaarzetten per gekoppelde stekker.

## Eerste increment

- `GET /api/v1/taken/:id/selectie` toegevoegd.
  - Geeft de taakuitvoering, gekoppelde stekkers, laatste configuratie en bestaande selectie-records terug.
  - Toegang volgt dezelfde taakbinding als de taakdetail-endpoints.
- `POST /api/v1/taken/:id/selectie` toegevoegd voor recordmanagers.
  - Alleen toegestaan voor de gekoppelde recordmanager en alleen vanuit status `init`.
  - Maakt per actieve gekoppelde stekker een `selectie`-record met status `AANGEVRAAGD`.
  - Pint de selectie vast op de nieuwste stekkerconfiguratie.
  - Schrijft per stekker een outbox-item `selectie:start`.
  - Schrijft een append-only `audit_event` met actie `SELECTION_REQUESTED`.
- De selectiepagina haalt nu API-data op via `GET /taken/:id/selectie`.
- De actie **Selectie ophalen** roept nu `POST /taken/:id/selectie` aan en toont daarna de actuele stekkerstatussen.
- De selectiepagina ververst lopende selecties automatisch zolang de selectie nog niet volledig is.
- Na succesvolle import verdwijnen **Selectie ophalen** en **Herkansen** uit het actiepanel.
- Bij een volledig succesvolle selectie toont de UI een doorgaan-melding met korte afteller, plus **Nu naar beoordeling** en **Hier blijven**.
- Eerste ingebouwde selectieworker toegevoegd.
  - Verwerkt open outbox-items `selectie:start`.
  - Roept `POST /selecties` op de stekker aan.
  - Slaat `extern_selectie_id`, status en stekkermetadata op.
  - Pollt lopende selecties via `GET /selecties/{selectieId}`.
  - Zet status, tellingen en foutmelding terug in de cockpitdatabase.
- Kandidaatimport toegevoegd.
  - Nieuwe tabel `vernietigingskandidaat` met unieke sleutel `(selectie_id, kandidaat_id)`.
  - De worker importeert `READY` selecties via `GET /selecties/{selectieId}/objecten?offset=...&limit=500`.
  - Kandidaten worden idempotent ge-upsert als bevroren snapshot bij de selectie.
  - Na volledige import gaat de selectie naar `GEIMPORTEERD`.
  - Zodra alle selecties bij een taakinstantie zijn geïmporteerd, gaat de taakinstantie van `init` naar `beoordeling`.
- `GET /api/v1/taken/:id/kandidaten` toegevoegd voor de beoordelingsstap.
  - Geeft geïmporteerde vernietigingskandidaten terug met taakcontext en verantwoordelijken.
  - De beoordelingspagina gebruikt deze databasekandidaten zodra er een access token is.
  - De bestaande mockdata blijft fallback tijdens ontwikkelwerk.
- Beoordelingsacties toegevoegd.
  - `PATCH /api/v1/taken/:id/kandidaten/:kandidaatId/beoordeling` slaat `AKKOORD` of `UITGESLOTEN` op bij de kandidaat.
  - De API controleert dat de kandidaat bij de taak hoort, dat de taak in status `beoordeling` staat en dat de ingelogde recordmanager gekoppeld is.
  - Elke beoordeling schrijft een audit-event `KANDIDAAT_BEOORDEELD`.
  - De beoordelingspagina initialiseert haar status uit de database en bewaart acties via dit endpoint.
- Voorleggen naar proceseigenaar-accordering toegevoegd.
  - `POST /api/v1/taken/:id/beoordeling/voorleggen` zet de taak van `beoordeling` naar `accordering_po`.
  - Voorleggen kan pas als alle kandidaten beoordeeld zijn.
  - De statusovergang schrijft audit-event `BEOORDELING_VOORGELEGD`.
- Proceseigenaar-accordering toegevoegd.
  - `PATCH /api/v1/taken/:id/kandidaten/:kandidaatId/accordering/proceseigenaar` registreert per kandidaat `AKKOORD` of `RETOUR`.
  - `RETOUR` markeert de kandidaat als retour naar de recordmanager.
  - `POST /api/v1/taken/:id/accordering/proceseigenaar/besluiten` rondt de stap af.
  - Bij retourkandidaten gaat de taak terug naar `beoordeling`; zonder retour gaat de taak door naar `accordering_archivaris`.
  - De proceseigenaarpagina gebruikt echte kandidaten uit de database en toont dezelfde snapshot-volgnummers als de recordmanagerpagina.
- Archivaris-accordering toegevoegd.
  - `PATCH /api/v1/taken/:id/kandidaten/:kandidaatId/accordering/archivaris` registreert per kandidaat `AKKOORD` of `RETOUR`.
  - `POST /api/v1/taken/:id/accordering/archivaris/besluiten` rondt de stap af.
  - Bij retourkandidaten gaat de taak terug naar `beoordeling`; zonder retour gaat de taak naar `vrijgegeven`.
  - De archivarispagina gebruikt echte kandidaten uit de database en toont dezelfde snapshot-volgnummers als de eerdere accorderingsstappen.
- Vernietigingsopdracht toegevoegd.
  - `POST /api/v1/taken/:id/vernietigingsopdracht` kan door de gekoppelde recordmanager worden gestart vanuit status `vrijgegeven`.
  - De API maakt per selectie met akkoord bevonden kandidaten een outbox-item `vernietiging:start`.
  - De taak gaat van `vrijgegeven` naar `uitvoering`.
  - De opdracht schrijft audit-event `VERNIETIGINGSOPDRACHT_GEGEVEN`.
  - De uitvoeringspagina roept dit endpoint aan via **Vernietigingsopdracht geven**.
- Vernietigingsworker toegevoegd.
  - `vernietiging:start` maakt via de stekker `POST /vernietigingen` een vernietigingsuitvoering aan.
  - De worker levert akkoord bevonden kandidaten in batches aan via `POST /vernietigingen/{id}/batches`.
  - Daarna geeft de worker de uitvoering vrij via `POST /vernietigingen/{id}/vrijgeven`.
  - Vernietigingsstatus, resultaatmetadata en resultaatregels worden opgeslagen op `selectie`.
  - Zodra alle selecties met akkoord-kandidaten klaar zijn, gaat de taak van `uitvoering` naar `resultaat`.
- Vernietigingsresultaten toegevoegd.
  - `GET /api/v1/taken/:id/vernietigingsresultaten` geeft de akkoord bevonden kandidaten terug met hun stekkerresultaat.
  - Het resultaatscherm gebruikt deze API en valt terug op mockdata tijdens ontwikkelwerk.

## Bewuste afbakening

- De worker draait nu ingebouwd in de API-runtime en kan later naar een aparte worker/queue worden verplaatst.
- `Uitstellen` is voorlopig alleen een lokale werkvoorraadstatus in de beoordelingspagina en telt niet als afgeronde beoordeling voor voorleggen.
- `Retour` hoort bij accordering door proceseigenaar of archivaris en is daarom geen actie in de recordmanager-beoordeling.
- Accordering bewaart nog geen apart accorderingsbesluit per kandidaat naast de kandidaatstatus; dat kan later worden genormaliseerd wanneer rapportage of volledige besluitgeschiedenis dit nodig maakt.
- Vernietigingsresultaten worden nog niet geïmporteerd naar een aparte resultaattabel; de stekkerrespons en resultaatregels worden voorlopig als runtime-metadata op `selectie` bewaard.

## Controle

- `npm run typecheck --workspace @vernietigingscockpit/cockpit-api`
- `npm run build --workspace @vernietigingscockpit/cockpit-api`
- `npx tsc -b apps/cockpit-web`
- `npm run build --workspace @vernietigingscockpit/cockpit-web`
- `npm run db:generate --workspace @vernietigingscockpit/cockpit-api`
- `npm run db:deploy --workspace @vernietigingscockpit/cockpit-api`
