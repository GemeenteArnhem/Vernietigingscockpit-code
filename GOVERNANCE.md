# Projectgovernance

De governance van het Vernietigingscockpit-ecosysteem (cockpit, stekkers en community) is vastgelegd in de architectuurrepo:

- [Governance – Vernietigingscockpit ecosysteem](https://github.com/GemeenteArnhem/Vernietigingscockpit/blob/dev/governance/governance.md)
- [Rollen en verantwoordelijkheden](https://github.com/GemeenteArnhem/Vernietigingscockpit/blob/dev/governance/rollen-en-verantwoordelijkheden.md)

Die documenten zijn leidend. Dit bestand beschrijft alleen hoe ze in deze coderepo worden toegepast.

## Rollen in deze repo

| Rol (governance) | In deze repo |
|---|---|
| Product owner of inhoudelijk opdrachtgever | Bepaalt functionele scope en prioriteiten, en brengt wijzigingsvoorstellen in als issue. Beslist niet zelfstandig over architectuur. |
| Architectuurboard | Bewaakt de architectuurprincipes en beslist over afwijkingen. Besluiten staan als ADR in de architectuurrepo; de code volgt die ADR's. |
| Beheerorganisatie | Het team vernietigingscockpit van Gemeente Arnhem ([.github/CODEOWNERS](.github/CODEOWNERS)). Is maintainer: reviewt en voegt pull requests samen, beheert branches, versies en releases, en handelt kwetsbaarheidsmeldingen af ([SECURITY.md](SECURITY.md)). |
| Community en contributors | Melden issues en dienen pull requests in volgens [CONTRIBUTING.md](CONTRIBUTING.md). |

De rollen in *Rollen en verantwoordelijkheden* (recordmanager, proceseigenaar, archivaris, beheer, auditor) zijn rollen in het vernietigingsproces. De cockpit vertaalt ze naar gebruikersrollen en dwingt de functiescheiding af; ze hebben geen rol in het beheer van deze repo.

## Besluitvorming

- **Code en reviews:** de maintainers beslissen of een pull request wordt samengevoegd (minstens één goedkeuring en groene CI, zie [CONTRIBUTING.md](CONTRIBUTING.md)).
- **Functionaliteit en prioriteiten:** de product owner, via issues.
- **Architectuur:** een wijziging die raakt aan de architectuurprincipes, de Stekker API, MDTO of de samenhang met stekkers, wordt eerst als voorstel (ADR) in de architectuurrepo besloten. Pas daarna volgt de implementatie hier. Een pull request verwijst naar de ADR.
- **Releases:** de maintainers, volgens SemVer en de releasestappen in [CONTRIBUTING.md](CONTRIBUTING.md). Binnen een majorversie zijn er geen brekende wijzigingen in de API; zolang de versie met 0 begint, kan dat wel in een minorversie.

Bij een conflict wordt eerst binnen deze kaders een oplossing gezocht. Lukt dat niet, dan volgt escalatie zoals beschreven in de governance van het ecosysteem (paragraaf 9). Afwijkingen en uitzonderingen worden gemotiveerd vastgelegd.

## Maintainers en medebeheer

Het beheer van deze repo ligt nu bij Gemeente Arnhem. Andere organisaties die structureel bijdragen, kunnen in overleg maintainer worden. Het team vernietigingscockpit beslist daarover; nieuwe maintainers worden toegevoegd aan [.github/CODEOWNERS](.github/CODEOWNERS).

## Wijzigen van dit document

Wijzigingen aan dit bestand gaan via een pull request en worden goedgekeurd door het team vernietigingscockpit. Wijzigingen aan de governance zelf gaan via de architectuurrepo.

---

## Project governance (English)

The governance of the Vernietigingscockpit ecosystem is defined in the [architecture repository](https://github.com/GemeenteArnhem/Vernietigingscockpit/tree/dev/governance) and takes precedence. In this repository, the team vernietigingscockpit of Gemeente Arnhem acts as maintainer: it reviews and merges pull requests, manages releases and handles security reports. Functional priorities are set by the product owner; architectural decisions are made as ADRs in the architecture repository before they are implemented here. Other organisations that contribute structurally may become maintainers by agreement.
