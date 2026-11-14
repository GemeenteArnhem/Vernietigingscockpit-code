# Bijdragen aan de Vernietigingscockpit

Fijn dat je wilt bijdragen. Deze repo wordt beheerd door Gemeente Arnhem (team vernietigingscockpit, zie [.github/CODEOWNERS](.github/CODEOWNERS)). Bijdragen van buiten het team zijn welkom via een issue en een pull request.

Door bij te dragen ga je akkoord met de [gedragscode](CODE_OF_CONDUCT.md). Een beveiligingsprobleem meld je niet in een issue, maar volgens [SECURITY.md](SECURITY.md).

## Werkwijze

1. **Open eerst een issue.** Beschrijf de bug of de wens. Zo voorkomen we dubbel werk en kan het team aangeven of de wijziging past bij de architectuur (ADR's in de architectuurrepo).
2. **Maak een featurebranch vanaf `dev`.** Gebruik een korte, beschrijvende naam, bijvoorbeeld `fix/etag-taak` of `beoordeling-opmerkingen`.
3. **Open een pull request naar `dev`.** Verwijs naar het issue en beschrijf wat er verandert en hoe je het hebt getest.
4. **Review en CI.** Een pull request wordt samengevoegd als:
   - minstens één reviewer, niet de auteur, heeft goedgekeurd;
   - alle CI-checks slagen (zie hieronder).

## Branches

| Branch | Doel |
|---|---|
| `main` | Vrijgegeven code. Alleen bijgewerkt vanuit `dev` bij een release. |
| `dev` | Integratiebranch. Alle pull requests gaan hierheen. |
| featurebranch | Eén wijziging, vanaf `dev`; wordt na het samenvoegen verwijderd. |

## Commitberichten

Eén korte Nederlandse zin over wat er verandert, bijvoorbeeld `Opmerkingen per record toegevoegd`. Er is geen vaste vorm. Houd een commit bij één onderwerp.

## Changelog

Werk in je pull request [CHANGELOG.md](CHANGELOG.md) bij onder **Nog niet uitgebracht**, als de wijziging merkbaar is voor gebruikers, beheerders of afnemers van de API. Gebruik de kopjes van Keep a Changelog: Toegevoegd, Gewijzigd, Verouderd, Verwijderd, Opgelost, Beveiliging.

## Versies en releases

De cockpit volgt [Semantic Versioning](https://semver.org/lang/nl/) met één versie voor de hele repo, in de root `package.json`. De workspaces houden versie `0.0.0`; ze worden niet los gepubliceerd.

Een release maken:

1. Kies het nieuwe versienummer: major bij een wijziging die niet achterwaarts compatibel is, minor bij nieuwe functionaliteit, patch bij alleen herstel. Zolang de versie met 0 begint, telt een niet-compatibele wijziging als minor.
2. Zet op een releasebranch vanaf `dev`:
   - de versie in de root `package.json` (en `package-lock.json`, met `npm version <versie> --no-git-tag-version`);
   - `softwareVersion` en `releaseDate` in [publiccode.yml](publiccode.yml);
   - in de changelog de inhoud van **Nog niet uitgebracht** onder een nieuw kopje `## [<versie>] - <datum>`, met de vergelijkingslinks onderaan.
3. Voeg samen naar `dev` en daarna `dev` naar `main`.
4. Zet op `main` de tag `v<versie>` en maak er een GitHub-release van met de tekst uit de changelog.

## Lokaal ontwikkelen

Vereisten: Node.js 22, npm en Docker (voor de integratie- en E2E-tests).

```bash
npm ci
npm run db:generate --workspace @vernietigingscockpit/cockpit-api
npm run dev:api
npm run dev:web
```

Een volledige omgeving met Keycloak en teststekker staat in [infrastructure/acceptatie/README.md](infrastructure/acceptatie/README.md).

## Controles voor een pull request

Draai deze controles lokaal; CI doet hetzelfde ([.github/workflows](.github/workflows)):

```bash
npm run typecheck
npm run lint
npm run test:dekking
npm run build
npm run test:e2e
```

- **Testdekking:** `test:dekking` faalt als de dekking onder de drempels in `apps/*/vitest.config.ts` zakt. Schrijf tests bij nieuwe code; de drempels gaan alleen omhoog.
- **Toegankelijkheid:** de paginatests in `apps/cockpit-web` controleren WCAG 2.1 AA met axe. Nieuwe pagina's krijgen ook zo'n test.
- **Gegenereerde bestanden:** heb je een endpoint of antwoord gewijzigd, draai dan `npm run generate:openapi --workspace @vernietigingscockpit/cockpit-api`. CI controleert ook de stekkertypes en het selectielijstenregister; zie de [README](README.md).
- **Licentie-informatie (REUSE):** alle bestanden vallen via [REUSE.toml](REUSE.toml) onder EUPL-1.2, © Gemeente Arnhem. Voeg je een bestand van derden toe, leg dan copyright en licentie vast in `REUSE.toml` en zet de licentietekst in `LICENSES/`. CI draait `reuse lint`.
- **Beveiliging:** CodeQL, `npm audit`, Trivy en een ZAP-baselinescan draaien in CI. Bevindingen met risico High of Critical laten de build falen.

## Licentie

De code valt onder de [EUPL-1.2](LICENSE). Door een bijdrage in te dienen, geef je toestemming om die onder dezelfde licentie te publiceren.

---

## Contributing (English)

Contributions are welcome. Please open an issue first to discuss the change, then open a pull request from a feature branch against `dev`. A pull request is merged after approval by at least one reviewer other than the author and when all CI checks pass. Run `npm run typecheck`, `npm run lint`, `npm run test:dekking`, `npm run build` and `npm run test:e2e` locally before opening a pull request. Report security issues as described in [SECURITY.md](SECURITY.md), not in a public issue. By contributing you agree to the [Code of Conduct](CODE_OF_CONDUCT.md) and to license your contribution under the [EUPL-1.2](LICENSE).
