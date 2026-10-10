// Gedeelde hulpfuncties en types van de taak-services.

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { canoniekeJson } from "../audit/audit-keten.js";
import type { KandidaatBeoordeling } from "./beoordeling.dto.js";
import type { AccorderingBesluit } from "./accordering.dto.js";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";
import type { VerklaringMetadata } from "../verklaring/verklaring-maker.js";
import type { KandidatenQuery } from "./kandidaten-lijst.js";
import type { ApiArchivering } from "@vernietigingscockpit/api-contract";

export type BesluitRol = "recordmanager" | "proceseigenaar" | "archivaris";

export const STANDAARD_KANDIDATEN_QUERY: KandidatenQuery = { offset: 0, limit: 250, zoekIn: "all", sort: "volgnummer", richting: "asc" };

export type StartSelectieInput = {
  peildatum?: string | null;
  stekkerId?: string | null;
};

// Status voor de uitvoeringsweergave, in de waarden die de UI al kent: de stekkerstatus,
// MISLUKT bij een mislukte opdracht of integriteitscontrole, en RUNNING zolang het loopt.
export function weergaveStatus(
  vernietiging: { status: string; stekkerStatus: string | null; externVernietigingId: string | null } | null
) {
  if (!vernietiging) {
    return null;
  }

  if (vernietiging.status === "MISLUKT" || vernietiging.status === "INTEGRITEIT_MISLUKT") {
    return "MISLUKT";
  }

  if (vernietiging.status === "AFGEROND") {
    return vernietiging.stekkerStatus;
  }

  return vernietiging.externVernietigingId ? "RUNNING" : null;
}

export function telResultaten(resultaten: Array<{ resultaat: string | null }>) {
  const tellingen = { success: 0, failed: 0, notFound: 0, skipped: 0, changed: 0 };

  for (const { resultaat } of resultaten) {
    switch (resultaat) {
      case "SUCCESS":
        tellingen.success += 1;
        break;
      case "FAILED":
        tellingen.failed += 1;
        break;
      case "NOT_FOUND":
        tellingen.notFound += 1;
        break;
      case "CHANGED":
        tellingen.changed += 1;
        break;
      case "SKIPPED":
        tellingen.skipped += 1;
        break;
    }
  }

  return tellingen;
}

// Batchgrootte uit stekker_configuratie.parameters.batchGrootte (1-1000), standaard 100.
export function leesBatchGrootte(parameters: Prisma.JsonValue) {
  const waarde =
    parameters && typeof parameters === "object" && !Array.isArray(parameters)
      ? (parameters as Record<string, unknown>).batchGrootte
      : undefined;

  return typeof waarde === "number" && Number.isInteger(waarde) && waarde >= 1 && waarde <= 1000 ? waarde : 100;
}

export function verdeelInBatches<T>(items: T[], grootte: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += grootte) {
    batches.push(items.slice(index, index + grootte));
  }

  return batches;
}

// Vingerafdruk van de lijst (CC-9): SHA-256 over de gesorteerde beoordelingen van alle
// kandidaten van de actieve selecties (id, beoordeling, uitsluitreden).
export async function berekenLijstHash(tx: Prisma.TransactionClient, taakinstantieId: string) {
  const kandidaten = await tx.vernietigingskandidaat.findMany({
    where: { selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } },
    select: { id: true, beoordeling: true, uitsluitReden: true },
    orderBy: { id: "asc" },
  });

  return createHash("sha256")
    .update(canoniekeJson(kandidaten.map((k) => [k.id, k.beoordeling, k.uitsluitReden ?? null])))
    .digest("hex");
}

export class LijstGewijzigdFout extends Error {
  constructor(
    readonly vrijgegevenHash: string | null,
    readonly huidigeHash: string
  ) {
    super("Lijst gewijzigd na vrijgave.");
  }
}

// De toelichting die de schermen tonen: van het laatste besluit van PO/archivaris als dat
// na de laatste beoordeling door de recordmanager kwam, anders die van de recordmanager.
export function zichtbareToelichting(kandidaat: {
  toelichting: string | null;
  beoordeeldOp: Date | null;
  besluiten: Array<{ toelichting: string | null; tijdstip: Date }>;
}) {
  const besluit = kandidaat.besluiten[0];

  return besluit && (!kandidaat.beoordeeldOp || besluit.tijdstip > kandidaat.beoordeeldOp)
    ? besluit.toelichting
    : kandidaat.toelichting;
}

export function mapArchivering(archivering: {
  id: string;
  status: string;
  adapter: string;
  locatie: string | null;
  dossierSha256: string | null;
  fout: string | null;
  aangevraagdOp: Date;
  afgerondOp: Date | null;
}): ApiArchivering {
  return {
    id: archivering.id,
    // De databasecheck staat alleen PENDING, SUCCESS en FAILED toe.
    status: archivering.status as ApiArchivering["status"],
    adapter: archivering.adapter,
    locatie: archivering.locatie,
    dossierSha256: archivering.dossierSha256,
    fout: archivering.fout,
    aangevraagdOp: archivering.aangevraagdOp.toISOString(),
    afgerondOp: archivering.afgerondOp?.toISOString() ?? null,
  };
}

export function taakStatusAntwoord(taak: { id: string; status: string; stapSinds: Date; versie: number }) {
  return {
    id: taak.id,
    status: taak.status,
    stapSinds: taak.stapSinds.toISOString(),
    versie: taak.versie,
  };
}

export async function telBeoordelingen(tx: Prisma.TransactionClient, taakinstantieId: string) {
  const groepen = await tx.vernietigingskandidaat.groupBy({
    by: ["beoordeling"],
    where: { selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } },
    _count: { _all: true },
  });
  const aantal = (beoordeling: string) =>
    groepen.find((groep) => groep.beoordeling === beoordeling)?._count._all ?? 0;

  return {
    totaal: groepen.reduce((som, groep) => som + groep._count._all, 0),
    opgenomen: aantal("OPGENOMEN"),
    akkoord: aantal("AKKOORD"),
    uitgesloten: aantal("UITGESLOTEN"),
    retour: aantal("RETOUR"),
  };
}

export function controleerFunctiescheiding(medewerkerId: string, eerdereRollen: string[]) {
  if (eerdereRollen.includes(medewerkerId)) {
    throw new ForbiddenException(
      "Functiescheiding: u heeft al een andere rol in deze taak en kunt dit besluit niet nemen."
    );
  }
}

export function parseOptionalDate(value: string | null | undefined, field: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is geen geldige datum.`);
  }

  return date;
}

export function formatDateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function parseKandidaatBeoordeling(value: string): KandidaatBeoordeling {
  if (value === "AKKOORD" || value === "UITGESLOTEN") {
    return value;
  }

  throw new BadRequestException(
    "beoordeling heeft geen geldige waarde voor de recordmanager."
  );
}

export function parseAccorderingBesluit(value: string): AccorderingBesluit {
  if (value === "AKKOORD" || value === "RETOUR") {
    return value;
  }

  throw new BadRequestException("besluit heeft geen geldige waarde.");
}

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export type StoredVerklaring = {
  id: string;
  versie: number;
  status: string;
  metadata: Prisma.JsonValue;
  pdfSha256: string;
  csvSha256: string;
  csvBestandsnaam: string;
  gegenereerdOp: Date;
};

export function mapStoredVerklaring(record: StoredVerklaring) {
  const metadata = record.metadata as unknown as VerklaringMetadata;

  return {
    ...metadata,
    id: record.id,
    beschikbaar: true,
    versie: record.versie,
    status: record.status,
    gegenereerdOp: record.gegenereerdOp.toISOString(),
    bijlage: {
      ...metadata.bijlage,
      bestandsnaam: record.csvBestandsnaam,
      sha256: record.csvSha256,
      pdfSha256: record.pdfSha256,
    },
  };
}

export function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// De kandidaten van een bulkverzoek; allemaal van deze taak (actieve selecties), anders 400.
export async function bulkKandidaten(tx: Prisma.TransactionClient, taakinstantieId: string, ids: string[]) {
  const uniek = Array.from(new Set(ids));
  const kandidaten = await tx.vernietigingskandidaat.findMany({
    where: { id: { in: uniek }, selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } },
    select: { id: true, beoordeling: true, uitsluitReden: true },
    orderBy: { id: "asc" },
  });

  if (kandidaten.length !== uniek.length) {
    throw new BadRequestException(
      `${uniek.length - kandidaten.length} van de ${uniek.length} kandidaten horen niet bij deze taak.`
    );
  }

  return kandidaten;
}
