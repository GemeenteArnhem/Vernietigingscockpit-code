import { z } from "zod";
import { APP_ROLES } from "./rollen.js";

// Invoerschema's per endpoint (CC-11), gedeeld door API en web-app (CC-19). Ze controleren vorm, type en lengte; inhoudelijke regels
// (bestaat de medewerker, functiescheiding, statusovergangen) blijven in de services.

// Id's: elke UUID in de vorm 8-4-4-4-12 (hex), zoals PostgreSQL ze accepteert. Niet strikt
// RFC 4122 (z.uuid()): bestaande id's zonder geldig versiecijfer, zoals de vaste id's uit de
// seed, moeten via de API bereikbaar blijven.
export const id = () => z.guid();
export const ID_PATROON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tekst = (max: number) => z.string().trim().max(max);
const optioneleTekst = (max: number) => tekst(max).nullish();
const DATUM = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const datum = z
  .string()
  .refine((waarde) => DATUM.test(waarde) && !Number.isNaN(new Date(waarde).getTime()), "verwacht een geldige datum (JJJJ-MM-DD)");

// --- taken -----------------------------------------------------------------------------

export const startSelectieSchema = z
  .object({
    peildatum: datum.nullish(),
    stekkerId: id().nullish(),
  })
  .default({});

export const kandidaatBeoordelingSchema = z.object({
  beoordeling: z.enum(["AKKOORD", "UITGESLOTEN"]),
  uitsluitReden: optioneleTekst(500),
  toelichting: optioneleTekst(2000),
});

export const accorderingBesluitSchema = z.object({
  besluit: z.enum(["AKKOORD", "RETOUR"]),
  toelichting: optioneleTekst(2000),
});

export const scopeSchema = z.enum(["mijn", "alle"]).default("mijn");

// --- auditlog --------------------------------------------------------------------------

const positiefGetal = (standaard: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(standaard);

export const auditlogQuerySchema = z.object({
  pagina: positiefGetal(1, 1_000_000),
  perPagina: positiefGetal(50, 200),
});

// --- taakdefinities --------------------------------------------------------------------

export const taakdefinitieSchema = z.object({
  naam: tekst(200).min(1),
  omschrijving: optioneleTekst(2000).transform((waarde) => waarde ?? undefined),
  categorie: tekst(100).min(1),
  frequentie: z.enum(["jaarlijks", "kwartaal", "maandelijks", "ad_hoc"]),
  startmaand: z.number().int().min(1).max(12).nullish(),
  recordmanagerId: id(),
  proceseigenaarId: id(),
  archivarisId: id(),
  stekkers: z
    .array(
      z.object({
        stekkerId: id(),
        selectieparameters: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .max(50)
    .default([]),
});

export const taakinstantieSchema = z
  .object({
    naam: tekst(200).optional(),
    peildatum: datum.nullish(),
  })
  .default({});

// --- stamgegevens ----------------------------------------------------------------------

export const stamgegevensImportSchema = z.object({
  afdelingen: z
    .array(
      z.object({
        code: tekst(50).optional(),
        naam: tekst(200).optional(),
        actief: z.boolean().optional(),
      })
    )
    .max(1_000)
    .optional(),
  medewerkers: z
    .array(
      z.object({
        naam: tekst(200).optional(),
        email: z.email().max(320).optional(),
        rollen: z.array(z.enum(APP_ROLES)).max(APP_ROLES.length).optional(),
        afdelingCode: optioneleTekst(50),
        actief: z.boolean().optional(),
        bron: tekst(50).optional(),
        externId: optioneleTekst(200),
      })
    )
    .max(10_000)
    .optional(),
});

export const rolQuerySchema = z.enum(APP_ROLES).optional();

// --- kandidatenlijst en bulk (CC-10) ----------------------------------------------------

const MAX_BULK = 20_000;

export const kandidatenQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(500),
  zoek: z.string().trim().max(200).optional().transform((waarde) => waarde || undefined),
  zoekIn: z.enum(["all", "omschrijving", "code", "vernietigingsdatum", "bronId"]).default("all"),
  status: z.enum(["nog-te-beoordelen", "afgerond", "conflict", "retour"]).optional(),
  // Beperken tot deze kandidaten (bijv. de in de browser uitgestelde records), komma-gescheiden.
  ids: z
    .string()
    .max(200 * 37)
    .optional()
    .transform((waarde) => (waarde ? waarde.split(",").filter(Boolean) : undefined))
    .pipe(z.array(id()).max(200).optional()),
  selectielijst: z.string().max(200).optional(),
  stekker: z.string().max(200).optional(),
  bewaartermijn: z.string().max(100).optional(),
  sort: z
    .enum([
      "omschrijving",
      "status",
      "volgnummer",
      "code",
      "selectielijst",
      "grondslag",
      "bewaartermijn",
      "vernietigingsdatum",
      "opmerking",
      "aantalObjecten",
      "aantalBetrokkenen",
      "periode",
      "stekker",
      "bronId",
    ])
    .default("volgnummer"),
  richting: z.enum(["asc", "desc"]).default("asc"),
});

const idsSchema = z.array(id()).min(1).max(MAX_BULK);

export const kandidaatIdsSchema = z.object({ ids: idsSchema });

export const bulkBeoordelingSchema = kandidaatBeoordelingSchema.extend({ ids: idsSchema });

export const bulkBesluitSchema = accorderingBesluitSchema.extend({ ids: idsSchema });

// --- invoertypes -------------------------------------------------------------------------
// `Invoer` is wat een client mag sturen (vóór standaardwaarden en trim); `Gevalideerd` is
// wat de API na validatie gebruikt.

export type StartSelectieInvoer = z.input<typeof startSelectieSchema>;
export type StartSelectieGevalideerd = z.output<typeof startSelectieSchema>;
export type KandidaatBeoordelingInvoer = z.input<typeof kandidaatBeoordelingSchema>;
export type KandidaatBeoordelingGevalideerd = z.output<typeof kandidaatBeoordelingSchema>;
export type AccorderingBesluitInvoer = z.input<typeof accorderingBesluitSchema>;
export type AccorderingBesluitGevalideerd = z.output<typeof accorderingBesluitSchema>;
export type Scope = z.output<typeof scopeSchema>;
export type AuditlogQuery = z.output<typeof auditlogQuerySchema>;
export type TaakdefinitieInvoer = z.input<typeof taakdefinitieSchema>;
export type TaakdefinitieGevalideerd = z.output<typeof taakdefinitieSchema>;
export type TaakinstantieInvoer = z.input<typeof taakinstantieSchema>;
export type TaakinstantieGevalideerd = z.output<typeof taakinstantieSchema>;
export type StamgegevensImportInvoer = z.input<typeof stamgegevensImportSchema>;
export type KandidatenQueryGevalideerd = z.output<typeof kandidatenQuerySchema>;
export type KandidatenSortering = KandidatenQueryGevalideerd["sort"];
export type KandidatenZoekIn = KandidatenQueryGevalideerd["zoekIn"];
export type KandidatenStatusFilter = NonNullable<KandidatenQueryGevalideerd["status"]>;
export type BulkBeoordelingInvoer = z.input<typeof bulkBeoordelingSchema>;
export type BulkBesluitInvoer = z.input<typeof bulkBesluitSchema>;
