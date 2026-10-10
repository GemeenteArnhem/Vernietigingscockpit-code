import type { Prisma } from "@prisma/client";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";

// Kandidatenlijst op de server (CC-10): pagineren, zoeken, filteren en sorteren gebeurt
// hier, zodat een taak met tienduizenden kandidaten nooit in één response hoeft.
// De zoek- en filtermogelijkheden volgen wat de beoordelings- en accorderingsschermen tonen.

export const SORTEERSLEUTELS = [
  "naam",
  "status",
  "volgnummer",
  "classificatie",
  "selectielijst",
  "informatiecategorie",
  "termijnLooptijd",
  "termijnEinddatum",
  "opmerking",
  "aantalObjecten",
  "aantalBetrokkenen",
  "dekkingInTijd",
  "stekker",
  "identificatie",
  "aggregatieniveau",
  "waardering",
] as const;

export type Sorteersleutel = (typeof SORTEERSLEUTELS)[number];

export const ZOEKVELDEN = ["all", "naam", "classificatie", "termijnEinddatum", "identificatie"] as const;

// Status zoals de schermen hem tonen, met de beoordeling in de database.
export const STATUS_NAAR_BEOORDELING = {
  "nog-te-beoordelen": "OPGENOMEN",
  afgerond: "AKKOORD",
  conflict: "UITGESLOTEN",
  retour: "RETOUR",
} as const;

export type KandidatenQuery = {
  offset: number;
  limit: number;
  zoek?: string;
  zoekIn: (typeof ZOEKVELDEN)[number];
  status?: keyof typeof STATUS_NAAR_BEOORDELING;
  ids?: string[];
  selectielijst?: string;
  stekker?: string;
  termijnLooptijd?: string;
  sort: Sorteersleutel;
  richting: "asc" | "desc";
};

export function kandidatenWhere(taakinstantieId: string, query: Omit<KandidatenQuery, "offset" | "limit" | "sort" | "richting">) {
  const voorwaarden: Prisma.VernietigingskandidaatWhereInput[] = [
    {
      selectie: {
        taakinstantieId,
        ...ACTIEVE_SELECTIE,
        ...(query.stekker ? { stekkerConfiguratie: { stekker: { naam: query.stekker } } } : {}),
      },
    },
  ];

  if (query.status) {
    voorwaarden.push({ beoordeling: STATUS_NAAR_BEOORDELING[query.status] });
  }
  if (query.ids) {
    voorwaarden.push({ id: { in: query.ids } });
  }
  if (query.selectielijst) {
    voorwaarden.push({ selectielijst: query.selectielijst });
  }
  if (query.termijnLooptijd) {
    voorwaarden.push({ termijnLooptijd: query.termijnLooptijd });
  }
  if (query.zoek) {
    voorwaarden.push(zoekVoorwaarde(query.zoek, query.zoekIn));
  }

  return { AND: voorwaarden } satisfies Prisma.VernietigingskandidaatWhereInput;
}

// Zoeken zoals in de tabel: tekst bevat de zoekterm (hoofdletterongevoelig). Voor de
// einddatum van de bewaartermijn, die de schermen als JJJJ-MM tonen, kan op jaar of jaar-maand.
function zoekVoorwaarde(zoek: string, zoekIn: KandidatenQuery["zoekIn"]): Prisma.VernietigingskandidaatWhereInput {
  const bevat = (veld: "naam" | "classificatieBegripCode" | "identificatieKenmerken") => ({
    [veld]: { contains: zoek, mode: "insensitive" as const },
  });
  const datum = datumBereik(zoek);
  const opDatum = datum ? { termijnEinddatum: { gte: datum.van, lt: datum.tot } } : null;

  switch (zoekIn) {
    case "naam":
      return bevat("naam");
    case "classificatie":
      return bevat("classificatieBegripCode");
    case "identificatie":
      return bevat("identificatieKenmerken");
    case "termijnEinddatum":
      return opDatum ?? { id: { in: [] } };
    default:
      return { OR: [bevat("naam"), bevat("classificatieBegripCode"), bevat("identificatieKenmerken"), ...(opDatum ? [opDatum] : [])] };
  }
}

export function datumBereik(zoek: string) {
  const match = /^(\d{4})(?:-(\d{1,2}))?$/.exec(zoek.trim());

  if (!match) {
    return null;
  }

  const jaar = Number(match[1]);
  const maand = match[2] ? Number(match[2]) : null;

  if (maand !== null && (maand < 1 || maand > 12)) {
    return null;
  }

  return maand === null
    ? { van: new Date(Date.UTC(jaar, 0, 1)), tot: new Date(Date.UTC(jaar + 1, 0, 1)) }
    : { van: new Date(Date.UTC(jaar, maand - 1, 1)), tot: new Date(Date.UTC(jaar, maand, 1)) };
}

// Sortering, altijd aangevuld met een vaste volgorde, zodat pagina's niet overlappen.
export function kandidatenOrderBy(sort: Sorteersleutel, richting: "asc" | "desc"): Prisma.VernietigingskandidaatOrderByWithRelationInput[] {
  const vast: Prisma.VernietigingskandidaatOrderByWithRelationInput[] = [{ kandidaatId: richting }, { id: richting }];
  const op = (veld: keyof Prisma.VernietigingskandidaatOrderByWithRelationInput) =>
    [{ [veld]: richting } as Prisma.VernietigingskandidaatOrderByWithRelationInput, ...vast];

  switch (sort) {
    case "naam":
      return op("naam");
    case "status":
      // AKKOORD < OPGENOMEN < RETOUR < UITGESLOTEN: dezelfde volgorde als de labels
      // Akkoord, Open, Retour, Uitgesloten.
      return op("beoordeling");
    case "volgnummer":
      return [{ termijnEinddatum: richting }, ...vast];
    case "classificatie":
      return op("classificatieBegripCode");
    case "selectielijst":
      return op("selectielijst");
    case "informatiecategorie":
      return op("informatiecategorieBegripLabel");
    case "termijnLooptijd":
      return op("termijnLooptijd");
    case "termijnEinddatum":
      return op("termijnEinddatum");
    case "opmerking":
      return op("toelichting");
    case "aantalObjecten":
      return op("aantalObjecten");
    case "aantalBetrokkenen":
      return op("aantalBetrokkenen");
    case "dekkingInTijd":
      return [{ dekkingInTijdBegindatum: richting }, { dekkingInTijdEinddatum: richting }, ...vast];
    case "stekker":
      return [{ selectie: { stekkerConfiguratie: { stekker: { naam: richting } } } }, ...vast];
    case "identificatie":
      return op("identificatieKenmerken");
    case "aggregatieniveau":
      return op("aggregatieniveau");
    case "waardering":
      return op("waarderingBegripLabel");
  }
}

// Volgnummer: de plek in de vaste volgorde van de taak (einddatum bewaartermijn, kandidaat-id),
// los van zoeken, filteren en sorteren, zoals de schermen het tot nu toe toonden.
export async function volgnummers(tx: Prisma.TransactionClient, taakinstantieId: string, ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, number>();
  }

  const rijen = await tx.$queryRaw<Array<{ id: string; volgnummer: bigint }>>`
    WITH genummerd AS (
      SELECT k."id",
             ROW_NUMBER() OVER (ORDER BY k."termijn_einddatum" ASC NULLS LAST, k."kandidaat_id" ASC, k."id" ASC) AS "volgnummer"
      FROM "vernietigingskandidaat" k
      JOIN "selectie" s ON s."id" = k."selectie_id"
      WHERE s."taakinstantie_id" = ${taakinstantieId}::uuid AND s."status" <> 'VERVANGEN'
    )
    SELECT "id"::text AS "id", "volgnummer" FROM genummerd WHERE "id" = ANY(${ids}::uuid[])`;

  return new Map(rijen.map((rij) => [rij.id, Number(rij.volgnummer)]));
}

// Facetten (keuzes in de filtermenu's) over de hele lijst van de taak.
export async function facetten(tx: Prisma.TransactionClient, taakinstantieId: string) {
  const basis = { selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } };
  const [beoordelingen, selectielijsten, looptijden, stekkers] = await Promise.all([
    tx.vernietigingskandidaat.groupBy({ by: ["beoordeling"], where: basis }),
    tx.vernietigingskandidaat.groupBy({ by: ["selectielijst"], where: basis }),
    tx.vernietigingskandidaat.groupBy({ by: ["termijnLooptijd"], where: basis }),
    tx.selectie.findMany({
      where: { taakinstantieId, ...ACTIEVE_SELECTIE, kandidaten: { some: {} } },
      select: { stekkerConfiguratie: { select: { stekker: { select: { naam: true } } } } },
    }),
  ]);
  const naarStatus = Object.fromEntries(Object.entries(STATUS_NAAR_BEOORDELING).map(([status, b]) => [b, status]));

  return {
    status: beoordelingen.map((groep) => naarStatus[groep.beoordeling]).filter(Boolean),
    selectielijst: selectielijsten.map((groep) => groep.selectielijst).filter((waarde): waarde is string => Boolean(waarde)).sort(),
    termijnLooptijd: looptijden.map((groep) => groep.termijnLooptijd).filter((waarde): waarde is string => Boolean(waarde)).sort(),
    stekker: Array.from(new Set(stekkers.map((selectie) => selectie.stekkerConfiguratie.stekker.naam))).sort(),
  };
}

// Samenvatting van een (bulk)selectie voor het detailpaneel: per veld de gedeelde waarde,
// of `null` als de selectie meerdere waarden heeft.
export function samenvatting(
  rijen: Array<{
    classificatieBegripCode: string | null;
    selectielijst: string | null;
    informatiecategorieBegripLabel: string | null;
    termijnLooptijd: string | null;
    dekkingInTijdBegindatum: string | null;
    dekkingInTijdEinddatum: string | null;
    termijnEinddatum: Date | null;
    aggregatieniveau: string;
    waarderingBegripLabel: string;
    beoordeling: string;
    aantalObjecten: number;
    aantalBetrokkenen: number;
    stekker: string;
    volgnummer: number;
  }>
) {
  const gedeeld = <T>(waarden: T[]) => {
    const uniek = Array.from(new Set(waarden.map((waarde) => JSON.stringify(waarde ?? null))));
    return uniek.length === 1 ? { waarde: JSON.parse(uniek[0]) as T | null, verschillend: false } : { waarde: null, verschillend: uniek.length > 1 };
  };
  const datums = rijen.map((rij) => rij.termijnEinddatum?.toISOString() ?? null).filter((d): d is string => d !== null).sort();
  const nummers = rijen.map((rij) => rij.volgnummer).filter((n) => n > 0);

  return {
    aantal: rijen.length,
    aantalObjecten: rijen.reduce((som, rij) => som + rij.aantalObjecten, 0),
    aantalBetrokkenen: rijen.reduce((som, rij) => som + rij.aantalBetrokkenen, 0),
    classificatie: gedeeld(rijen.map((rij) => rij.classificatieBegripCode)),
    selectielijst: gedeeld(rijen.map((rij) => rij.selectielijst)),
    informatiecategorie: gedeeld(rijen.map((rij) => rij.informatiecategorieBegripLabel)),
    termijnLooptijd: gedeeld(rijen.map((rij) => rij.termijnLooptijd)),
    stekker: gedeeld(rijen.map((rij) => rij.stekker)),
    aggregatieniveau: gedeeld(rijen.map((rij) => rij.aggregatieniveau)),
    waardering: gedeeld(rijen.map((rij) => rij.waarderingBegripLabel)),
    dekkingInTijd: gedeeld(rijen.map((rij): [string | null, string | null] => [rij.dekkingInTijdBegindatum, rij.dekkingInTijdEinddatum])),
    termijnEinddatum: { van: datums[0] ?? null, tot: datums.at(-1) ?? null },
    volgnummer: { van: nummers.length ? Math.min(...nummers) : null, tot: nummers.length ? Math.max(...nummers) : null },
    statussen: Array.from(new Set(rijen.map((rij) => rij.beoordeling))).sort(),
  };
}
