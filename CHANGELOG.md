# Changelog

Alle noemenswaardige wijzigingen aan de Vernietigingscockpit staan in dit bestand.

De vorm volgt [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/) en de versienummers volgen [Semantic Versioning](https://semver.org/lang/nl/). Zolang de versie met 0 begint, is de cockpit in ontwikkeling en kan een minorversie wijzigingen bevatten die niet achterwaarts compatibel zijn.

Het versienummer van de cockpit staat los van de versie van de cockpit-API in `apps/cockpit-api/openapi.json`; die volgt het pad `/api/v1`.

## [Nog niet uitgebracht]

## [0.1.0] - nog niet uitgebracht

Eerste versie.

### Toegevoegd

- Inloggen via OpenID Connect, met rollen recordmanager, proceseigenaar, archivaris, functioneel beheerder en auditor.
- Beheer van stekkers (Stekker API v2, MDTO), afdelingen, stamgegevens en selectielijsten (register Cockpit-selectielijsten, ADR-0008).
- Taakdefinities en taken: selectie ophalen bij de stekker, beoordelen door de recordmanager, voorleggen aan en accorderen door proceseigenaar en archivaris, vernietigingsopdracht en uitvoering via de stekker.
- Startpagina en werkvoorraad per rol, opmerkingen per record en meekijken.
- Verklaring van vernietiging als PDF, met CSV-bijlage.
- Onveranderbaar auditlog met ketenverificatie (ADR-0003).
- Achtergrondworker met wachtrij voor uitvoering en archivering.
- OpenAPI 3.1-specificatie van de cockpit-API, gegenereerd uit de code, op `/api/v1/openapi.json`.
- Containers voor web, API/worker en migraties, die als niet-root gebruiker draaien.
- Repository-inrichting volgens de NeRDS-leidraad: EUPL-1.2-licentie, publiccode.yml, SECURITY.md, gedragscode, CONTRIBUTING.md en CODEOWNERS.
- CI met typecheck, lint, tests met testdekkingsdrempels, toegankelijkheidstests (WCAG 2.1 AA met axe), E2E-tests, CodeQL, npm audit, Trivy en een ZAP-baselinescan.

[Nog niet uitgebracht]: https://github.com/GemeenteArnhem/Vernietigingscockpit-code/compare/v0.1.0...dev
[0.1.0]: https://github.com/GemeenteArnhem/Vernietigingscockpit-code/releases/tag/v0.1.0
