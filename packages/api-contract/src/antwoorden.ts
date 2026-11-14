// Antwoorden van de cockpit-API (CC-19), als zod-schema's met de types daaruit afgeleid. De
// API geeft de types op als returntype van de services, de web-app gebruikt ze bij het
// ophalen; zo merkt de compiler het als de twee uit elkaar lopen. De schema's zijn de bron
// voor de OpenAPI-specificatie (NeRDS-leidraad H4/H9, API Design Rules). Datums zijn ISO-strings.
//
// Elk schema met een eigen naam staat in `apiAntwoordRegister`; in de OpenAPI-specificatie
// wordt het een component onder die naam.

import { z } from "zod";

import { APP_ROLES } from "./rollen.js";

export const apiAntwoordRegister = z.registry<{ id: string; description?: string }, z.ZodType>();

function benoemd<T extends z.ZodType>(id: string, schema: T, description?: string): T {
  apiAntwoordRegister.add(schema, description ? { id, description } : { id });
  return schema;
}

const datumTijd = z.string().describe("ISO 8601");

export const apiMedewerkerSchema = benoemd(
  "ApiMedewerker",
  z.object({
    id: z.string(),
    naam: z.string(),
    email: z.string().optional(),
    rollen: z.array(z.string()).optional(),
  })
);
export type ApiMedewerker = z.infer<typeof apiMedewerkerSchema>;

export const apiStekkerSchema = benoemd(
  "ApiStekker",
  z.object({
    id: z.string(),
    naam: z.string(),
    omschrijving: z.string().nullish(),
  })
);
export type ApiStekker = z.infer<typeof apiStekkerSchema>;

export const apiVerantwoordelijkenSchema = benoemd(
  "ApiVerantwoordelijken",
  z.object({
    recordmanager: apiMedewerkerSchema,
    proceseigenaar: apiMedewerkerSchema,
    archivaris: apiMedewerkerSchema,
  })
);
export type ApiVerantwoordelijken = z.infer<typeof apiVerantwoordelijkenSchema>;

// Naam en e-mail van een verantwoordelijke, zoals de taakstappen die tonen.
export const apiPersoonSchema = benoemd(
  "ApiPersoon",
  z.object({
    naam: z.string(),
    email: z.string().nullish(),
  })
);
export type ApiPersoon = z.infer<typeof apiPersoonSchema>;

export const apiTellingenSchema = benoemd(
  "ApiTellingen",
  z.object({
    totaalKandidaten: z.number().int(),
    totaalObjecten: z.number().int(),
    totaalBetrokkenen: z.number().int(),
  })
);
export type ApiTellingen = z.infer<typeof apiTellingenSchema>;

export const apiTaakdefinitieSamenvattingSchema = benoemd(
  "ApiTaakdefinitieSamenvatting",
  z.object({
    id: z.string(),
    naam: z.string(),
    categorie: z.string(),
    frequentie: z.string(),
  })
);
export type ApiTaakdefinitieSamenvatting = z.infer<typeof apiTaakdefinitieSamenvattingSchema>;

export const apiTaakinstantieSchema = benoemd(
  "ApiTaakinstantie",
  z.object({
    id: z.string(),
    naam: z.string(),
    status: z.string(),
    stapSinds: datumTijd,
    peildatum: z.string().nullish(),
    // Geplande startdatum van een terugkerende taak; ervoor toont de UI 'Gepland'.
    geplandOp: z.string().nullish(),
    gestartOp: z.string().nullish(),
    taakdefinitie: apiTaakdefinitieSamenvattingSchema.optional(),
    verantwoordelijken: apiVerantwoordelijkenSchema,
    tellingen: apiTellingenSchema,
    toegestaneActies: z.array(z.string()).optional(),
  })
);
export type ApiTaakinstantie = z.infer<typeof apiTaakinstantieSchema>;

export const apiTaakdefinitieSchema = benoemd(
  "ApiTaakdefinitie",
  z.object({
    id: z.string(),
    naam: z.string(),
    omschrijving: z.string().nullish(),
    categorie: z.string(),
    frequentie: z.string(),
    verantwoordelijken: apiVerantwoordelijkenSchema,
    stekkers: z.array(apiStekkerSchema),
    instanties: z.array(apiTaakinstantieSchema).optional(),
    toegestaneActies: z.array(z.string()).optional(),
  })
);
export type ApiTaakdefinitie = z.infer<typeof apiTaakdefinitieSchema>;

export const apiMeSchema = benoemd(
  "ApiMe",
  z.object({
    id: z.string(),
    username: z.string().optional(),
    name: z.string().optional(),
    email: z.string().nullish(),
    roles: z.array(z.enum(APP_ROLES)),
    actions: z.array(z.string()),
    medewerkerId: z.string().nullish(),
    medewerker: z
      .object({
        id: z.string(),
        naam: z.string(),
        email: z.string(),
        afdeling: z.object({ naam: z.string(), code: z.string() }).nullable(),
      })
      .nullish(),
    laatstGezien: z.string().optional(),
  })
);
export type ApiMe = z.infer<typeof apiMeSchema>;

// --- health ------------------------------------------------------------------------------

export const apiHealthSchema = benoemd(
  "ApiHealth",
  z.object({
    status: z.string(),
    app: z.string().optional(),
    checks: z.record(z.string(), z.string()).optional(),
    timestamp: datumTijd,
  })
);
export type ApiHealth = z.infer<typeof apiHealthSchema>;

// --- stamgegevens en stekkers ------------------------------------------------------------

export const apiIdentificatieSchema = benoemd(
  "ApiIdentificatie",
  z.object({ identificatieKenmerk: z.string(), identificatieBron: z.string() })
);
export type ApiIdentificatie = z.infer<typeof apiIdentificatieSchema>;

export const apiVerwijzingSchema = benoemd(
  "ApiVerwijzing",
  z.object({
    verwijzingNaam: z.string(),
    verwijzingIdentificatie: apiIdentificatieSchema.optional(),
  })
);
export type ApiVerwijzing = z.infer<typeof apiVerwijzingSchema>;

export const apiAfdelingSchema = benoemd(
  "ApiAfdeling",
  z.object({
    id: z.string(),
    naam: z.string(),
    code: z.string(),
    actief: z.boolean(),
  })
);
export type ApiAfdeling = z.infer<typeof apiAfdelingSchema>;

export const apiStamgegevensMedewerkerSchema = benoemd(
  "ApiStamgegevensMedewerker",
  z.object({
    id: z.string(),
    naam: z.string(),
    email: z.string(),
    rollen: z.array(z.string()),
    archiefvormer: apiVerwijzingSchema.nullish(),
    afdeling: z.object({ naam: z.string(), code: z.string() }).nullish(),
  })
);
export type ApiStamgegevensMedewerker = z.infer<typeof apiStamgegevensMedewerkerSchema>;

export const apiStamgegevensImportSchema = benoemd(
  "ApiStamgegevensImport",
  z.object({ afdelingen: z.number().int(), medewerkers: z.number().int() }),
  "Aantal geïmporteerde afdelingen en medewerkers."
);
export type ApiStamgegevensImport = z.infer<typeof apiStamgegevensImportSchema>;

export const apiStekkerOptieSchema = benoemd(
  "ApiStekkerOptie",
  z.object({
    id: z.string(),
    naam: z.string(),
    omschrijving: z.string().nullish(),
    actief: z.boolean(),
    laatsteConfiguratie: z
      .object({
        versie: z.number().int(),
        baseUrl: z.string(),
        authType: z.string(),
        verwachteApiMajor: z.number().int(),
      })
      .nullish(),
  })
);
export type ApiStekkerOptie = z.infer<typeof apiStekkerOptieSchema>;

// --- stekkerbeheer ----------------------------------------------------------------------

export const apiStekkerConfiguratieSchema = benoemd(
  "ApiStekkerConfiguratie",
  z.object({
    versie: z.number().int(),
    baseUrl: z.string(),
    authType: z.string(),
    tokenUrl: z.string().nullable(),
    clientId: z.string().nullable(),
    // Het secret zelf komt nooit uit de API; alleen of er een is.
    secretIngesteld: z.boolean(),
    secretRef: z.string().nullable(),
    scopes: z.array(z.string()),
    verwachteApiMajor: z.number().int(),
    timeouts: z.record(z.string(), z.unknown()),
    parameters: z.record(z.string(), z.unknown()),
    aangemaaktDoor: z.string(),
    aangemaaktOp: datumTijd,
  })
);
export type ApiStekkerConfiguratie = z.infer<typeof apiStekkerConfiguratieSchema>;

export const apiStekkerBeheerSchema = benoemd(
  "ApiStekkerBeheer",
  z.object({
    id: z.string(),
    naam: z.string(),
    omschrijving: z.string().nullable(),
    actief: z.boolean(),
    // Waar de stekker in gebruik is; verwijderen kan alleen als beide 0 zijn.
    gebruik: z.object({ taakdefinities: z.number().int(), selecties: z.number().int() }),
    configuratie: apiStekkerConfiguratieSchema.nullable(),
    versies: z.array(z.object({ versie: z.number().int(), aangemaaktDoor: z.string(), aangemaaktOp: datumTijd })),
    toegestaneActies: z.array(z.string()),
  })
);
export type ApiStekkerBeheer = z.infer<typeof apiStekkerBeheerSchema>;

// --- selectie ----------------------------------------------------------------------------

export const apiSelectieStekkerSchema = benoemd(
  "ApiSelectieStekker",
  z.object({
    stekker: z.object({
      id: z.string(),
      naam: z.string(),
      omschrijving: z.string().nullish(),
      actief: z.boolean(),
    }),
    configuratie: z
      .object({
        id: z.string(),
        versie: z.number().int(),
        baseUrl: z.string(),
        verwachteApiMajor: z.number().int(),
      })
      .nullish(),
    selectie: z
      .object({
        id: z.string(),
        externSelectieId: z.string().nullish(),
        status: z.string(),
        peildatum: z.string().nullish(),
        selectietijdstip: z.string().nullish(),
        totaalKandidaten: z.number().int(),
        totaalObjecten: z.number().int(),
        totaalBetrokkenen: z.number().int(),
        geimporteerd: z.number().int(),
        fout: z.string().nullish(),
      })
      .nullish(),
  })
);
export type ApiSelectieStekker = z.infer<typeof apiSelectieStekkerSchema>;

export const apiTaakSelectieSchema = benoemd(
  "ApiTaakSelectie",
  z.object({
    taak: z.object({
      id: z.string(),
      naam: z.string(),
      status: z.string(),
      peildatum: z.string().nullish(),
      taakdefinitie: z.object({ id: z.string(), naam: z.string() }),
    }),
    stekkers: z.array(apiSelectieStekkerSchema),
  })
);
export type ApiTaakSelectie = z.infer<typeof apiTaakSelectieSchema>;

export const apiSelectieGestartSchema = benoemd(
  "ApiSelectieGestart",
  apiTaakSelectieSchema.extend({
    // Id's van de selecties die deze aanvraag heeft gemaakt.
    aangemaakteSelecties: z.array(z.string()),
  })
);
export type ApiSelectieGestart = z.infer<typeof apiSelectieGestartSchema>;

// --- kandidatenlijst (CC-10) -------------------------------------------------------------

export const apiTaakContextSchema = benoemd(
  "ApiTaakContext",
  z.object({
    id: z.string(),
    naam: z.string(),
    status: z.string(),
    stapSinds: datumTijd,
    // Taakversie voor If-Match bij statuswijzigingen.
    versie: z.number().int(),
    verantwoordelijken: z.object({
      recordmanager: apiPersoonSchema,
      proceseigenaar: apiPersoonSchema,
      archivaris: apiPersoonSchema,
    }),
    // Archiefvormer van de taak (vastgepind bij aanmaken, ADR-0005 B-M3); geldt voor elke
    // kandidaat zonder eigen archiefvormer.
    archiefvormer: apiVerwijzingSchema.nullish(),
  })
);
export type ApiTaakContext = z.infer<typeof apiTaakContextSchema>;

// --- MDTO (ADR-0005): de gegevens van een vernietigingskandidaat --------------------------

export const apiBegripSchema = benoemd(
  "ApiBegrip",
  z.object({
    begripLabel: z.string(),
    begripCode: z.string().optional(),
    begripBegrippenlijst: apiVerwijzingSchema,
  })
);
export type ApiBegrip = z.infer<typeof apiBegripSchema>;

export const apiDekkingInTijdSchema = benoemd(
  "ApiDekkingInTijd",
  z.object({
    dekkingInTijdType: apiBegripSchema,
    dekkingInTijdBegindatum: z.string(),
    dekkingInTijdEinddatum: z.string().optional(),
  })
);
export type ApiDekkingInTijd = z.infer<typeof apiDekkingInTijdSchema>;

export const apiBewaartermijnSchema = benoemd(
  "ApiBewaartermijn",
  z.object({
    termijnTriggerStartLooptijd: apiBegripSchema.nullable(),
    termijnStartdatumLooptijd: z.string().nullable(),
    termijnLooptijd: z.string().nullable(),
    termijnEinddatum: z.string(),
  })
);
export type ApiBewaartermijn = z.infer<typeof apiBewaartermijnSchema>;

// De selectielijst van de informatiecategorie (ADR-0008): de selectielijstcode, met de titel uit
// het register Cockpit-selectielijsten, of een vaste melding als de code daar niet in staat.
export const apiSelectielijstSchema = benoemd(
  "ApiSelectielijst",
  z.object({ code: z.string(), naam: z.string(), bekend: z.boolean() })
);
export type ApiSelectielijst = z.infer<typeof apiSelectielijstSchema>;

// Het MDTO-profiel van een kandidaat (Stekker API v2), zoals de cockpit het teruggeeft.
export const apiMdtoKandidaatSchema = benoemd(
  "ApiMdtoKandidaat",
  z.object({
    vernietigingskandidaatId: z.string(),
    identificatie: z.array(apiIdentificatieSchema),
    naam: z.string(),
    omschrijving: z.array(z.string()).nullable(),
    aggregatieniveau: z.string(),
    classificatie: z.array(apiBegripSchema).nullable(),
    dekkingInTijd: z.array(apiDekkingInTijdSchema).nullable(),
    waardering: apiBegripSchema,
    bewaartermijn: apiBewaartermijnSchema,
    informatiecategorie: apiBegripSchema,
    // Cockpituitbreiding: de selectielijst uit `informatiecategorie.begripBegrippenlijst`.
    selectielijst: apiSelectielijstSchema,
    informatiecategorieAfwijking: z.object({ toelichting: z.string(), norm: apiVerwijzingSchema.optional() }).nullable(),
    gerelateerdInformatieobject: z.array(z.unknown()).nullable(),
    archiefvormer: z.array(apiVerwijzingSchema).nullable(),
    activiteit: apiVerwijzingSchema.nullable(),
    aantalObjecten: z.number().int(),
    aantalBetrokkenen: z.number().int(),
    // Toelichting van de stekker (cockpituitbreiding).
    stekkerToelichting: z.string().nullable(),
  })
);
export type ApiMdtoKandidaat = z.infer<typeof apiMdtoKandidaatSchema>;

// Opmerking van recordmanager, proceseigenaar of archivaris bij een kandidaat (besluit
// 2026-11-12). `verwijderbaar`: de ingelogde gebruiker is de auteur en zit in die stap.
export const apiOpmerkingSchema = benoemd(
  "ApiOpmerking",
  z.object({
    id: z.string(),
    rol: z.enum(["recordmanager", "proceseigenaar", "archivaris"]),
    medewerker: z.object({ id: z.string(), naam: z.string() }),
    ronde: z.number().int(),
    tekst: z.string(),
    tijdstip: datumTijd,
    verwijderbaar: z.boolean(),
  })
);
export type ApiOpmerking = z.infer<typeof apiOpmerkingSchema>;

export const apiKandidaatSchema = benoemd(
  "ApiKandidaat",
  apiMdtoKandidaatSchema.extend({
    id: z.string(),
    volgnummer: z.number().int(),
    beoordeling: z.string(),
    uitsluitReden: z.string().nullish(),
    toelichting: z.string().nullish(),
    // Alle niet-verwijderde opmerkingen, oudste eerst.
    opmerkingen: z.array(apiOpmerkingSchema),
    stekker: z.object({ naam: z.string() }),
  })
);
export type ApiKandidaat = z.infer<typeof apiKandidaatSchema>;

export const apiKandidatenPaginaSchema = benoemd(
  "ApiKandidatenPagina",
  z.object({
    taak: apiTaakContextSchema,
    // Deze pagina, plus tellingen en filterkeuzes over de hele lijst.
    pagina: z.object({ offset: z.number().int(), limit: z.number().int(), totaal: z.number().int() }),
    tellingen: z.object({
      totaal: z.number().int(),
      opgenomen: z.number().int(),
      akkoord: z.number().int(),
      uitgesloten: z.number().int(),
      retour: z.number().int(),
    }),
    // `selectielijst`: de selectielijstcodes (ADR-0008); het filter `selectielijst` werkt op de code.
    facetten: z.object({
      status: z.array(z.string()),
      selectielijst: z.array(z.string()),
      termijnLooptijd: z.array(z.string()),
      stekker: z.array(z.string()),
    }),
    kandidaten: z.array(apiKandidaatSchema),
  })
);
export type ApiKandidatenPagina = z.infer<typeof apiKandidatenPaginaSchema>;

export const apiKandidaatIdsSchema = benoemd("ApiKandidaatIds", z.object({ ids: z.array(z.string()) }));
export type ApiKandidaatIds = z.infer<typeof apiKandidaatIdsSchema>;

export type ApiGedeeld<T> = { waarde: T | null; verschillend: boolean };

function gedeeld<T extends z.ZodType>(waarde: T) {
  return z.object({ waarde: waarde.nullable(), verschillend: z.boolean() });
}

export const apiSelectieSamenvattingSchema = benoemd(
  "ApiSelectieSamenvatting",
  z.object({
    aantal: z.number().int(),
    aantalObjecten: z.number().int(),
    aantalBetrokkenen: z.number().int(),
    classificatie: gedeeld(z.string()),
    selectielijst: gedeeld(apiSelectielijstSchema),
    informatiecategorie: gedeeld(z.string()),
    termijnLooptijd: gedeeld(z.string()),
    stekker: gedeeld(z.string()),
    aggregatieniveau: gedeeld(z.string()),
    waardering: gedeeld(z.string()),
    dekkingInTijd: gedeeld(z.tuple([z.string().nullable(), z.string().nullable()])),
    termijnEinddatum: z.object({ van: z.string().nullable(), tot: z.string().nullable() }),
    volgnummer: z.object({ van: z.number().int().nullable(), tot: z.number().int().nullable() }),
    statussen: z.array(z.string()),
  })
);
export type ApiSelectieSamenvatting = z.infer<typeof apiSelectieSamenvattingSchema>;

export const apiBijgewerktSchema = benoemd("ApiBijgewerkt", z.object({ bijgewerkt: z.number().int() }));
export type ApiBijgewerkt = z.infer<typeof apiBijgewerktSchema>;

// --- beoordeling, accordering en statuswijzigingen ---------------------------------------

export const apiKandidaatBeoordelingSchema = benoemd(
  "ApiKandidaatBeoordeling",
  z.object({
    id: z.string(),
    beoordeling: z.string(),
    uitsluitReden: z.string().nullish(),
    toelichting: z.string().nullish(),
    versie: z.number().int(),
  })
);
export type ApiKandidaatBeoordeling = z.infer<typeof apiKandidaatBeoordelingSchema>;

export const apiKandidaatAccorderingSchema = benoemd(
  "ApiKandidaatAccordering",
  z.object({
    id: z.string(),
    beoordeling: z.string(),
    toelichting: z.string().nullish(),
    versie: z.number().int(),
  })
);
export type ApiKandidaatAccordering = z.infer<typeof apiKandidaatAccorderingSchema>;

export const apiTaakStatusSchema = benoemd(
  "ApiTaakStatus",
  z.object({
    id: z.string(),
    status: z.string(),
    stapSinds: datumTijd,
    versie: z.number().int(),
  })
);
export type ApiTaakStatus = z.infer<typeof apiTaakStatusSchema>;

export const apiVernietigingsopdrachtSchema = benoemd(
  "ApiVernietigingsopdracht",
  apiTaakStatusSchema.extend({
    totaalKandidaten: z.number().int(),
    aantalOpdrachten: z.number().int(),
  })
);
export type ApiVernietigingsopdracht = z.infer<typeof apiVernietigingsopdrachtSchema>;

// --- uitvoering en resultaten ------------------------------------------------------------

export const apiResultaatTellingenSchema = benoemd(
  "ApiResultaatTellingen",
  z.object({
    success: z.number().int(),
    failed: z.number().int(),
    notFound: z.number().int(),
    skipped: z.number().int(),
    changed: z.number().int(),
  })
);
export type ApiResultaatTellingen = z.infer<typeof apiResultaatTellingenSchema>;

export const apiUitvoeringStekkerSchema = benoemd(
  "ApiUitvoeringStekker",
  z.object({
    id: z.string(),
    naam: z.string(),
    versie: z.string().nullish(),
    stekkerStatus: z.string(),
    selectieId: z.string(),
    externSelectieId: z.string().nullish(),
    externVernietigingId: z.string().nullish(),
    vernietigingStatus: z.string().nullish(),
    vernietigingGestartOp: z.string().nullish(),
    vernietigingAfgerondOp: z.string().nullish(),
    aantalKandidaten: z.number().int(),
    batchGrootte: z.number().int().optional(),
    aantalObjecten: z.number().int(),
    fout: z.string().nullish(),
    // Wijze van vernietiging volgens de stekker (B-M4), vanaf de vrijgave.
    vernietigingsmethode: z.string().nullish(),
    vernietigingsmethodeToelichting: z.string().nullish(),
    resultaatTellingen: apiResultaatTellingenSchema,
    toegestaneActies: z.array(z.string()).optional(),
  })
);
export type ApiUitvoeringStekker = z.infer<typeof apiUitvoeringStekkerSchema>;

export const apiUitvoeringSchema = benoemd(
  "ApiUitvoering",
  z.object({
    // toegestaneActies: welke taakacties de API toestaat, bijv. vernietiging.opdracht_geven.
    taak: apiTaakContextSchema.extend({ toegestaneActies: z.array(z.string()).optional() }),
    stekkers: z.array(apiUitvoeringStekkerSchema),
  })
);
export type ApiUitvoering = z.infer<typeof apiUitvoeringSchema>;

export const apiVernietigingsresultaatSchema = benoemd(
  "ApiVernietigingsresultaat",
  apiMdtoKandidaatSchema.extend({
    id: z.string(),
    // Leeg zolang de stekker nog geen resultaat heeft gemeld (CC-8).
    resultaat: z.string().nullable(),
    // Tijdstip van vernietiging (MDTO-event Vernietigen), alleen bij SUCCESS.
    eventTijd: z.string().nullable(),
    // Vernietigingsmethode van de stekker (B-M4).
    vernietigingsmethode: z.string().nullable(),
    foutcode: z.string().nullish(),
    foutmelding: z.string().nullish(),
    bronstatus: z.string().nullish(),
    logReference: z.string().nullish(),
    correlatieId: z.string().nullish(),
    // Opmerkingen uit beoordeling en accordering (alleen lezen; `verwijderbaar` is altijd false).
    opmerkingen: z.array(apiOpmerkingSchema),
    stekker: z.object({ naam: z.string() }),
  })
);
export type ApiVernietigingsresultaat = z.infer<typeof apiVernietigingsresultaatSchema>;

export const apiArchiveringSchema = benoemd(
  "ApiArchivering",
  z.object({
    id: z.string(),
    status: z.enum(["PENDING", "SUCCESS", "FAILED"]),
    adapter: z.string(),
    locatie: z.string().nullable(),
    // SHA-256 van dossier.mdto.xml in het archiefpakket.
    dossierSha256: z.string().nullable(),
    fout: z.string().nullable(),
    aangevraagdOp: datumTijd,
    afgerondOp: z.string().nullable(),
  })
);
export type ApiArchivering = z.infer<typeof apiArchiveringSchema>;

export const apiArchiveringStandSchema = benoemd(
  "ApiArchiveringStand",
  z.object({ taakStatus: z.string(), archivering: apiArchiveringSchema.nullable() })
);
export type ApiArchiveringStand = z.infer<typeof apiArchiveringStandSchema>;

export const apiVernietigingsresultatenSchema = benoemd(
  "ApiVernietigingsresultaten",
  z.object({
    // Archivering (CC-18): laatste poging en of de recordmanager nu kan archiveren.
    taak: apiTaakContextSchema.extend({
      toegestaneActies: z.array(z.string()).optional(),
      archivering: apiArchiveringSchema.nullish(),
    }),
    resultaten: z.array(apiVernietigingsresultaatSchema),
  })
);
export type ApiVernietigingsresultaten = z.infer<typeof apiVernietigingsresultatenSchema>;

// --- verklaring (CC-17) ------------------------------------------------------------------

// Tijdens de uitvoering is er nog niets; daarna (tot de worker klaar is) een voorbeeld
// met `beschikbaar: false`, en vanaf de opgeslagen versie `beschikbaar: true`.
export const apiVerklaringNietBeschikbaarSchema = benoemd(
  "ApiVerklaringNietBeschikbaar",
  z.object({ beschikbaar: z.literal(false), status: z.string() })
);
export type ApiVerklaringNietBeschikbaar = z.infer<typeof apiVerklaringNietBeschikbaarSchema>;

export const apiVerklaringTaakSchema = benoemd(
  "ApiVerklaringTaak",
  z.object({
    id: z.string(),
    naam: z.string(),
    status: z.string(),
    stapSinds: datumTijd,
    taakdefinitie: z.string(),
    peildatum: z.string().nullable(),
    rondes: z.number().int(),
    afgerondOp: z.string().nullable(),
    verantwoordelijken: z.object({
      recordmanager: apiPersoonSchema,
      proceseigenaar: apiPersoonSchema,
      archivaris: apiPersoonSchema,
    }),
  })
);
export type ApiVerklaringTaak = z.infer<typeof apiVerklaringTaakSchema>;

export const apiVerklaringOpnieuwSchema = benoemd(
  "ApiVerklaringOpnieuw",
  z.object({ taakinstantieId: z.string(), jobId: z.string() }),
  "De verklaring wordt opnieuw gemaakt door de worker (job in de outbox)."
);
export type ApiVerklaringOpnieuw = z.infer<typeof apiVerklaringOpnieuwSchema>;

export const apiVernietigingsverklaringSchema = benoemd(
  "ApiVernietigingsverklaring",
  z.object({
    id: z.string().optional(),
    beschikbaar: z.boolean(),
    taak: apiVerklaringTaakSchema,
    versie: z.number().int(),
    status: z.string(),
    gegenereerdOp: datumTijd,
    bijlage: z.object({
      bestandsnaam: z.string(),
      contentType: z.string(),
      aantalRegels: z.number().int(),
      sha256: z.string(),
    }),
    tellingen: apiResultaatTellingenSchema.extend({
      aantalObjecten: z.number().int(),
      aantalBetrokkenen: z.number().int(),
    }),
  })
);
export type ApiVernietigingsverklaring = z.infer<typeof apiVernietigingsverklaringSchema>;

export const apiVerklaringSchema = benoemd(
  "ApiVerklaring",
  z.union([apiVernietigingsverklaringSchema, apiVerklaringNietBeschikbaarSchema])
);
export type ApiVerklaring = z.infer<typeof apiVerklaringSchema>;

// --- auditlog (ADR-0003) -------------------------------------------------------------------

export const apiAuditEventSchema = benoemd(
  "ApiAuditEvent",
  z.object({
    id: z.string(),
    tijdstip: datumTijd,
    actor: z.object({ type: z.string(), id: z.string().nullable(), naam: z.string().nullable() }),
    rol: z.string().nullable(),
    eventType: z.string(),
    eventTypeBegrippenlijst: z.string(),
    entiteit: z.object({ type: z.string(), id: z.string() }),
    details: z.unknown(),
    correlatieId: z.string().nullable(),
    hash: z.string(),
  })
);
export type ApiAuditEvent = z.infer<typeof apiAuditEventSchema>;

export const apiAuditlogPaginaSchema = benoemd(
  "ApiAuditlogPagina",
  z.object({
    pagina: z.number().int(),
    perPagina: z.number().int(),
    totaal: z.number().int(),
    items: z.array(apiAuditEventSchema),
  })
);
export type ApiAuditlogPagina = z.infer<typeof apiAuditlogPaginaSchema>;

const ketenFoutSchema = z.object({ id: z.string(), reden: z.enum(["hash", "schakel"]) });

export const apiAuditVerificatieSchema = benoemd(
  "ApiAuditVerificatie",
  z.object({
    taakinstantieId: z.string(),
    intact: z.boolean(),
    aantalEvents: z.number().int(),
    laatsteHash: z.string().nullable(),
    // Begrensd: bij een kapotte keten volstaan de eerste afwijkingen.
    fouten: z.array(ketenFoutSchema),
  })
);
export type ApiAuditVerificatie = z.infer<typeof apiAuditVerificatieSchema>;

// --- Werkkopie en grafsteen (ADR-0006) -----------------------------------------------------

export const apiWerkkopieBewaartermijnSchema = benoemd(
  "ApiWerkkopieBewaartermijn",
  z.object({
    sleutel: z.literal("werkkopie_bewaartermijn"),
    waarde: z.string(),
    // "standaard": nog niet vastgelegd; geldt de beginwaarde WERKKOPIE_BEWAARTERMIJN.
    bron: z.enum(["instelling", "standaard"]),
    gewijzigdOp: z.string().nullable(),
  })
);
export type ApiWerkkopieBewaartermijn = z.infer<typeof apiWerkkopieBewaartermijnSchema>;

export const apiGrafsteenSchema = benoemd(
  "ApiGrafsteen",
  z.object({
    id: z.string(),
    taakinstantieId: z.string(),
    taakdefinitieId: z.string(),
    archiefvormer: apiVerwijzingSchema,
    archivering: z.object({
      id: z.string(),
      adapter: z.string(),
      locatie: z.string(),
      openzaakZaakId: z.string().nullable(),
      dossierSha256: z.string(),
    }),
    verificatie: z.object({ tijdstip: datumTijd, uitkomst: z.string(), aantalBestanden: z.number().int() }),
    auditlog: z.object({ aantalEvents: z.number().int(), laatsteHash: z.string() }),
    lijstHash: z.string().nullable(),
    verklaring: z.object({ versie: z.number().int().nullable(), pdfSha256: z.string().nullable() }),
    afgerondOp: z.string().nullable(),
    gearchiveerdOp: datumTijd,
    verwijderdOp: datumTijd,
    bewaartermijnWerkkopie: z.string(),
    hash: z.string(),
  })
);
export type ApiGrafsteen = z.infer<typeof apiGrafsteenSchema>;

export const apiDossierSchema = benoemd(
  "ApiDossier",
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("werkkopie_aanwezig"), taakinstantieId: z.string(), taakStatus: z.string() }),
    z.object({ status: z.literal("werkkopie_verwijderd"), taakinstantieId: z.string(), grafsteen: apiGrafsteenSchema }),
  ])
);
export type ApiDossier = z.infer<typeof apiDossierSchema>;

export const apiGrafsteenVerificatieSchema = benoemd(
  "ApiGrafsteenVerificatie",
  z.object({
    intact: z.boolean(),
    aantal: z.number().int(),
    laatsteHash: z.string().nullable(),
    fouten: z.array(ketenFoutSchema),
  })
);
export type ApiGrafsteenVerificatie = z.infer<typeof apiGrafsteenVerificatieSchema>;
