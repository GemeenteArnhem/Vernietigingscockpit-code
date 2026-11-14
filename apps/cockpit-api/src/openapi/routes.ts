// Register van alle endpoints van de cockpit-API voor de OpenAPI-specificatie. Elke
// controllermethode met een route moet hier staan; de generator en de unittest falen anders.
// Zie route.ts voor wat de generator zelf uit de controller haalt.
import { z } from "zod";
import {
  apiAfdelingSchema,
  apiArchiveringSchema,
  apiArchiveringStandSchema,
  apiAuditlogPaginaSchema,
  apiAuditVerificatieSchema,
  apiBijgewerktSchema,
  apiDossierSchema,
  apiGrafsteenVerificatieSchema,
  apiHealthSchema,
  apiKandidaatAccorderingSchema,
  apiKandidaatBeoordelingSchema,
  apiKandidaatIdsSchema,
  apiKandidatenPaginaSchema,
  apiMeSchema,
  apiSelectieGestartSchema,
  apiSelectieSamenvattingSchema,
  apiStamgegevensImportSchema,
  apiStamgegevensMedewerkerSchema,
  apiStekkerBeheerSchema,
  apiStekkerOptieSchema,
  apiTaakdefinitieSchema,
  apiTaakinstantieSchema,
  apiTaakSelectieSchema,
  apiTaakStatusSchema,
  apiUitvoeringSchema,
  apiVerklaringOpnieuwSchema,
  apiVerklaringSchema,
  apiVernietigingsopdrachtSchema,
  apiVernietigingsresultatenSchema,
  apiWerkkopieBewaartermijnSchema,
} from "@vernietigingscockpit/api-contract";

import { AuditController } from "../modules/audit/audit.controller.js";
import { HealthController } from "../modules/health/health.controller.js";
import { MeController } from "../modules/me/me.controller.js";
import { StamgegevensController } from "../modules/stamgegevens/stamgegevens.controller.js";
import { StekkerbeheerController } from "../modules/stekkers/stekkerbeheer.controller.js";
import { StekkersController } from "../modules/stekkers/stekkers.controller.js";
import { TaakdefinitiesController } from "../modules/taakdefinities/taakdefinities.controller.js";
import { TakenController } from "../modules/taken/taken.controller.js";
import { DossiersController, WerkkopieInstellingController } from "../modules/werkkopie/werkkopie.controller.js";
import { OpenApiController } from "./openapi.controller.js";
import { bestand, json, leeg, route, type RouteDef } from "./route.js";

// Functies in plaats van constanten: openapi.controller -> document -> routes -> openapi.controller
// is een kringverwijzing; de lijsten worden pas opgebouwd als ze nodig zijn.
export function alleControllers() {
  return [
  HealthController,
  OpenApiController,
  MeController,
  StamgegevensController,
  StekkersController,
  StekkerbeheerController,
  TaakdefinitiesController,
  TakenController,
  AuditController,
  WerkkopieInstellingController,
  DossiersController,
  ];
}

const T = {
  systeem: "Systeem",
  gebruiker: "Gebruiker",
  stamgegevens: "Stamgegevens",
  stekkers: "Stekkers",
  taakdefinities: "Taakdefinities",
  taken: "Taken",
  selectie: "Selectie",
  beoordeling: "Beoordeling en accordering",
  uitvoering: "Uitvoering en verklaring",
  audit: "Auditlog",
  werkkopie: "Werkkopie en dossiers",
};

export function alleRoutes(): RouteDef[] {
  return [
  // --- systeem ---
  route(HealthController, "getLive", { tag: T.systeem, samenvatting: "Liveness: de API draait", antwoord: json(apiHealthSchema) }),
  route(HealthController, "getReady", {
    tag: T.systeem,
    samenvatting: "Readiness: de API en de database zijn bereikbaar",
    beschrijving: "Geeft 503 als de database niet bereikbaar is.",
    antwoord: json(apiHealthSchema),
  }),
  route(OpenApiController, "specificatie", {
    tag: T.systeem,
    samenvatting: "Deze OpenAPI-specificatie",
    antwoord: json(z.record(z.string(), z.unknown())),
  }),

  // --- gebruiker en stamgegevens ---
  route(MeController, "getMe", { tag: T.gebruiker, samenvatting: "De ingelogde gebruiker met rollen", antwoord: json(apiMeSchema) }),
  route(StamgegevensController, "importStamgegevens", {
    tag: T.stamgegevens,
    samenvatting: "Afdelingen en medewerkers importeren",
    antwoord: json(apiStamgegevensImportSchema),
  }),
  route(StamgegevensController, "getAfdelingen", { tag: T.stamgegevens, samenvatting: "Afdelingen", antwoord: json(z.array(apiAfdelingSchema)) }),
  route(StamgegevensController, "getMedewerkers", {
    tag: T.stamgegevens,
    samenvatting: "Actieve medewerkers, eventueel met een rol",
    antwoord: json(z.array(apiStamgegevensMedewerkerSchema)),
  }),

  // --- stekkers ---
  route(StekkersController, "getStekkers", {
    tag: T.stekkers,
    samenvatting: "Stekkers om aan een taakdefinitie te koppelen",
    antwoord: json(z.array(apiStekkerOptieSchema)),
  }),
  route(StekkerbeheerController, "lijst", { tag: T.stekkers, samenvatting: "Alle stekkers (beheer)", antwoord: json(z.array(apiStekkerBeheerSchema)) }),
  route(StekkerbeheerController, "detail", {
    tag: T.stekkers,
    samenvatting: "Eén stekker (beheer)",
    beschrijving: "Geeft de configuratieversie als ETag, voor If-Match bij bewerken.",
    antwoord: json(apiStekkerBeheerSchema),
  }),
  route(StekkerbeheerController, "aanmaken", { tag: T.stekkers, samenvatting: "Stekker aanmaken", antwoord: json(apiStekkerBeheerSchema) }),
  route(StekkerbeheerController, "bewerken", {
    tag: T.stekkers,
    samenvatting: "Stekker bewerken (nieuwe configuratieversie)",
    antwoord: json(apiStekkerBeheerSchema),
  }),
  route(StekkerbeheerController, "deactiveren", { tag: T.stekkers, samenvatting: "Stekker deactiveren", antwoord: json(apiStekkerBeheerSchema) }),
  route(StekkerbeheerController, "activeren", { tag: T.stekkers, samenvatting: "Stekker activeren", antwoord: json(apiStekkerBeheerSchema) }),
  route(StekkerbeheerController, "verwijderen", {
    tag: T.stekkers,
    samenvatting: "Stekker verwijderen",
    beschrijving: "Alleen als de stekker niet in gebruik is.",
    antwoord: leeg(),
  }),

  // --- taakdefinities ---
  route(TaakdefinitiesController, "createTaakdefinitie", {
    tag: T.taakdefinities,
    samenvatting: "Taakdefinitie aanmaken",
    antwoord: json(apiTaakdefinitieSchema),
  }),
  route(TaakdefinitiesController, "createTaakinstantie", {
    tag: T.taakdefinities,
    samenvatting: "Taakuitvoering starten",
    antwoord: json(apiTaakinstantieSchema),
  }),
  route(TaakdefinitiesController, "getTaakdefinities", {
    tag: T.taakdefinities,
    samenvatting: "Taakdefinities (eigen of alle)",
    antwoord: json(z.array(apiTaakdefinitieSchema)),
  }),
  route(TaakdefinitiesController, "getTaakdefinitie", { tag: T.taakdefinities, samenvatting: "Eén taakdefinitie", antwoord: json(apiTaakdefinitieSchema) }),
  route(TaakdefinitiesController, "verwijderTaakdefinitie", { tag: T.taakdefinities, samenvatting: "Taakdefinitie verwijderen", antwoord: leeg() }),
  route(TaakdefinitiesController, "verwijderTaakinstantie", { tag: T.taakdefinities, samenvatting: "Taakuitvoering verwijderen", antwoord: leeg() }),

  // --- taken ---
  route(TakenController, "getTaken", { tag: T.taken, samenvatting: "Taakuitvoeringen (eigen of alle)", antwoord: json(z.array(apiTaakinstantieSchema)) }),
  route(TakenController, "getTaak", {
    tag: T.taken,
    samenvatting: "Eén taakuitvoering",
    beschrijving: "Geeft de taakversie als ETag, voor If-Match bij statuswijzigingen.",
    antwoord: json(apiTaakinstantieSchema),
  }),

  // --- selectie ---
  route(TakenController, "getSelectie", { tag: T.selectie, samenvatting: "Selectie per stekker", antwoord: json(apiTaakSelectieSchema) }),
  route(TakenController, "startSelectie", { tag: T.selectie, samenvatting: "Selectie starten bij de stekkers", antwoord: json(apiSelectieGestartSchema) }),

  // --- beoordeling en accordering ---
  route(TakenController, "getKandidaten", {
    tag: T.beoordeling,
    samenvatting: "Kandidaten per pagina, met zoeken, filteren en sorteren",
    antwoord: json(apiKandidatenPaginaSchema),
  }),
  route(TakenController, "getKandidaatIds", {
    tag: T.beoordeling,
    samenvatting: "Alle id's die aan de filters voldoen",
    antwoord: json(apiKandidaatIdsSchema),
  }),
  route(TakenController, "getKandidatenSamenvatting", {
    tag: T.beoordeling,
    samenvatting: "Gedeelde waarden van een selectie kandidaten",
    antwoord: json(apiSelectieSamenvattingSchema),
  }),
  route(TakenController, "bulkBeoordeling", { tag: T.beoordeling, samenvatting: "Beoordeling van meerdere kandidaten", antwoord: json(apiBijgewerktSchema) }),
  route(TakenController, "bulkBesluitProceseigenaar", {
    tag: T.beoordeling,
    samenvatting: "Besluit van de proceseigenaar over meerdere kandidaten",
    antwoord: json(apiBijgewerktSchema),
  }),
  route(TakenController, "bulkBesluitArchivaris", {
    tag: T.beoordeling,
    samenvatting: "Besluit van de archivaris over meerdere kandidaten",
    antwoord: json(apiBijgewerktSchema),
  }),
  route(TakenController, "updateKandidaatBeoordeling", {
    tag: T.beoordeling,
    samenvatting: "Beoordeling van één kandidaat",
    antwoord: json(apiKandidaatBeoordelingSchema),
  }),
  route(TakenController, "verwijderOpmerking", { tag: T.beoordeling, samenvatting: "Eigen opmerking verwijderen", antwoord: leeg() }),
  route(TakenController, "beoordelingVoorleggen", {
    tag: T.beoordeling,
    samenvatting: "Beoordeling voorleggen aan de proceseigenaar",
    antwoord: json(apiTaakStatusSchema),
  }),
  route(TakenController, "updateProceseigenaarAccordering", {
    tag: T.beoordeling,
    samenvatting: "Besluit van de proceseigenaar over één kandidaat",
    antwoord: json(apiKandidaatAccorderingSchema),
  }),
  route(TakenController, "proceseigenaarBesluiten", {
    tag: T.beoordeling,
    samenvatting: "Accordering proceseigenaar afronden",
    antwoord: json(apiTaakStatusSchema),
  }),
  route(TakenController, "updateArchivarisAccordering", {
    tag: T.beoordeling,
    samenvatting: "Besluit van de archivaris over één kandidaat",
    antwoord: json(apiKandidaatAccorderingSchema),
  }),
  route(TakenController, "archivarisBesluiten", { tag: T.beoordeling, samenvatting: "Accordering archivaris afronden", antwoord: json(apiTaakStatusSchema) }),

  // --- uitvoering, verklaring en archivering ---
  route(TakenController, "vernietigingsopdracht", {
    tag: T.uitvoering,
    samenvatting: "Vernietigingsopdracht geven aan de stekkers",
    antwoord: json(apiVernietigingsopdrachtSchema),
  }),
  route(TakenController, "getUitvoering", { tag: T.uitvoering, samenvatting: "Stand van de uitvoering per stekker", antwoord: json(apiUitvoeringSchema) }),
  route(TakenController, "vernietigingOpnieuw", {
    tag: T.uitvoering,
    samenvatting: "Uitvoering bij één stekker opnieuw starten",
    antwoord: json(apiUitvoeringSchema),
  }),
  route(TakenController, "getVernietigingsresultaten", {
    tag: T.uitvoering,
    samenvatting: "Resultaat per kandidaat",
    antwoord: json(apiVernietigingsresultatenSchema),
  }),
  route(TakenController, "getVerklaring", { tag: T.uitvoering, samenvatting: "Gegevens van de verklaring van vernietiging", antwoord: json(apiVerklaringSchema) }),
  route(TakenController, "verklaringOpnieuw", {
    tag: T.uitvoering,
    samenvatting: "Verklaring opnieuw laten maken",
    antwoord: json(apiVerklaringOpnieuwSchema),
  }),
  route(TakenController, "getVerklaringPdf", { tag: T.uitvoering, samenvatting: "Verklaring van vernietiging (PDF)", antwoord: bestand("application/pdf") }),
  route(TakenController, "getVerklaringBijlageCsv", {
    tag: T.uitvoering,
    samenvatting: "Bijlage bij de verklaring (CSV)",
    antwoord: bestand("text/csv; charset=utf-8"),
  }),
  route(TakenController, "archiveren", { tag: T.uitvoering, samenvatting: "Dossier archiveren", antwoord: json(apiArchiveringSchema) }),
  route(TakenController, "getArchivering", { tag: T.uitvoering, samenvatting: "Stand van de archivering", antwoord: json(apiArchiveringStandSchema) }),

  // --- auditlog ---
  route(AuditController, "getAuditlog", { tag: T.audit, samenvatting: "Auditlog van een taak per pagina", antwoord: json(apiAuditlogPaginaSchema) }),
  route(AuditController, "verifieer", { tag: T.audit, samenvatting: "Hashketen van het auditlog controleren", antwoord: json(apiAuditVerificatieSchema) }),

  // --- werkkopie en dossiers ---
  route(WerkkopieInstellingController, "lees", {
    tag: T.werkkopie,
    samenvatting: "Bewaartermijn van de werkkopie",
    antwoord: json(apiWerkkopieBewaartermijnSchema),
  }),
  route(WerkkopieInstellingController, "zet", {
    tag: T.werkkopie,
    samenvatting: "Bewaartermijn van de werkkopie instellen",
    antwoord: json(apiWerkkopieBewaartermijnSchema),
  }),
  route(DossiersController, "verifieerGrafstenen", {
    tag: T.werkkopie,
    samenvatting: "Hashketen van de grafstenen controleren",
    antwoord: json(apiGrafsteenVerificatieSchema),
  }),
  route(DossiersController, "dossier", { tag: T.werkkopie, samenvatting: "Dossier: werkkopie of grafsteen", antwoord: json(apiDossierSchema) }),
  ];
}
