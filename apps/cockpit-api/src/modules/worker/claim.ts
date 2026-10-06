import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { PrismaService } from "../../shared/db/prisma.service.js";

// Claimen van werk door een worker (CC-7, B-A: Postgres-outbox, geen extra queue-component).
//
// Een worker zet `geclaimd_tot`/`geclaimd_door` met FOR UPDATE SKIP LOCKED: gelijktijdige
// workers slaan rijen over die een ander net claimt, en een rij met een lopende lease.
// Na de lease (bijv. na een crash) mag een andere worker de rij overnemen. Het afronden
// controleert dat de claim nog van deze worker is (ClaimVerlorenFout), zodat een te late
// worker geen resultaat meer vastlegt.

export const STANDAARD_LEASE_MS = 300_000;

export function leesLeaseMs(waarde: string | undefined) {
  const getal = Number(waarde);
  return Number.isInteger(getal) && getal > 0 ? getal : STANDAARD_LEASE_MS;
}

// Altijd uniek per proces: WORKER_ID is alleen een herkenbaar voorvoegsel. Zo krijgen
// opgeschaalde replica's (met dezelfde env) en een herstarte worker een eigen id.
export function maakWorkerId(voorvoegsel?: string) {
  return `${voorvoegsel?.trim() || `${hostname()}-${process.pid}`}-${randomUUID().slice(0, 8)}`;
}

export class ClaimVerlorenFout extends Error {
  constructor(soort: string, id: string) {
    super(`Claim op ${soort} ${id} is verlopen en door een andere worker overgenomen.`);
  }
}

export type Claim = { worker: string; leaseMs: number; nu: Date; limiet: number };

export type ClaimSoort = "outbox" | "selectie" | "vernietiging";

// Heartbeat: de lease verlengen vóór elke (mogelijk trage) aanroep binnen een stap. Een
// stap met meerdere stekkeraanroepen kan zo langer duren dan de lease zonder dat een andere
// worker het werk overneemt en het eindeloos opnieuw begint. Een gecrashte worker verlengt
// niet meer, dus overname na de lease blijft werken. Is de claim al van een ander, dan
// ClaimVerlorenFout: deze worker stopt met de stap.
export async function verlengClaim(prisma: PrismaService, soort: ClaimSoort, id: string, worker: string, leaseMs: number) {
  const where = { id, geclaimdDoor: worker };
  const data = { geclaimdTot: new Date(Date.now() + leaseMs) };
  const { count } =
    soort === "outbox"
      ? await prisma.client.outbox.updateMany({ where, data })
      : soort === "selectie"
        ? await prisma.client.selectie.updateMany({ where, data })
        : await prisma.client.vernietiging.updateMany({ where, data });

  if (count === 0) {
    throw new ClaimVerlorenFout(soort === "outbox" ? "job" : soort, id);
  }
}

export async function claimJobs(prisma: PrismaService, queue: string, jobNaam: string, claim: Claim) {
  const tot = new Date(claim.nu.getTime() + claim.leaseMs);
  const rijen = await prisma.client.$queryRaw<Array<{ id: string }>>`
    UPDATE "outbox"
    SET "geclaimd_tot" = ${tot}, "geclaimd_door" = ${claim.worker}
    WHERE "id" IN (
      SELECT "id" FROM "outbox"
      WHERE "queue" = ${queue}
        AND "job_naam" = ${jobNaam}
        AND "status" = 'OPEN'
        AND "volgende_poging_op" <= ${claim.nu}
        AND ("geclaimd_tot" IS NULL OR "geclaimd_tot" < ${claim.nu})
      ORDER BY "aangemaakt_op"
      LIMIT ${claim.limiet}::int
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"::text AS "id"`;

  return rijen.map((rij) => rij.id);
}

export type SelectieWerk = "poll-selectie" | "import-selectie";

export async function claimSelecties(prisma: PrismaService, werk: SelectieWerk, claim: Claim) {
  const tot = new Date(claim.nu.getTime() + claim.leaseMs);
  const vrij = (rijen: Array<{ id: string }>) => rijen.map((rij) => rij.id);

  // Drie vaste queries (geen dynamische SQL): welke selecties bij welk soort werk horen.
  switch (werk) {
    case "poll-selectie":
      return vrij(await prisma.client.$queryRaw<Array<{ id: string }>>`
        UPDATE "selectie" SET "geclaimd_tot" = ${tot}, "geclaimd_door" = ${claim.worker}
        WHERE "id" IN (
          SELECT "id" FROM "selectie"
          WHERE "extern_selectie_id" IS NOT NULL
            AND "status" IN ('AANGEVRAAGD', 'RUNNING')
            AND ("volgende_poll_op" IS NULL OR "volgende_poll_op" <= ${claim.nu})
            AND ("geclaimd_tot" IS NULL OR "geclaimd_tot" < ${claim.nu})
          LIMIT ${claim.limiet}::int
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id"::text AS "id"`);
    case "import-selectie":
      return vrij(await prisma.client.$queryRaw<Array<{ id: string }>>`
        UPDATE "selectie" SET "geclaimd_tot" = ${tot}, "geclaimd_door" = ${claim.worker}
        WHERE "id" IN (
          SELECT "id" FROM "selectie"
          WHERE "extern_selectie_id" IS NOT NULL
            AND "status" = 'READY'
            AND ("geclaimd_tot" IS NULL OR "geclaimd_tot" < ${claim.nu})
          LIMIT ${claim.limiet}::int
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id"::text AS "id"`);
  }
}

// Claim op een selectie teruggeven na een poll of import (alleen als hij nog van ons is).
export async function geefSelectieVrij(prisma: PrismaService, selectieId: string, worker: string) {
  await prisma.client.selectie.updateMany({
    where: { id: selectieId, geclaimdDoor: worker },
    data: { geclaimdTot: null, geclaimdDoor: null },
  });
}

// Vernietigingen die vrijgegeven zijn en aan de beurt zijn voor een statusvraag (CC-8).
export async function claimVernietigingen(prisma: PrismaService, claim: Claim) {
  const tot = new Date(claim.nu.getTime() + claim.leaseMs);
  const rijen = await prisma.client.$queryRaw<Array<{ id: string }>>`
    UPDATE "vernietiging" SET "geclaimd_tot" = ${tot}, "geclaimd_door" = ${claim.worker}
    WHERE "id" IN (
      SELECT "id" FROM "vernietiging"
      WHERE "status" = 'LOPEND'
        AND "vrijgegeven_op" IS NOT NULL
        AND "volgende_poll_op" <= ${claim.nu}
        AND ("geclaimd_tot" IS NULL OR "geclaimd_tot" < ${claim.nu})
      ORDER BY "volgende_poll_op"
      LIMIT ${claim.limiet}::int
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"::text AS "id"`;

  return rijen.map((rij) => rij.id);
}

export async function geefVernietigingVrij(prisma: PrismaService, vernietigingId: string, worker: string) {
  await prisma.client.vernietiging.updateMany({
    where: { id: vernietigingId, geclaimdDoor: worker },
    data: { geclaimdTot: null, geclaimdDoor: null },
  });
}
