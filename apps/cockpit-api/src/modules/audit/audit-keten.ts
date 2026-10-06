import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { AppRole } from "../auth/app-role.js";
import type { AuthUser } from "../auth/auth-user.js";
import type { AuditActie, ConfiguratieActie } from "./audit-acties.js";

// Eén plek voor het schrijven en controleren van audit-events (ADR-0003):
// - audit_event: een hashketen per taakinstantie; configuratie_event: één globale keten;
// - vóór het lezen van de vorige hash een advisory lock op de keten (geen vertakkingen);
// - hash = SHA-256 over canonieke JSON van alle kolommen behalve id en hash.

export type AuditActor =
  | { type: "user"; user: AuthUser; rol: AppRole }
  | { type: "system"; naam?: string };

export type AuditEventInvoer = {
  taakinstantieId: string;
  actie: AuditActie;
  entiteitType: string;
  entiteitId: string;
  details: Prisma.InputJsonValue;
};

export type ConfiguratieEventInvoer = {
  actie: ConfiguratieActie;
  entiteitType: string;
  entiteitId: string;
  details: Prisma.InputJsonValue;
};

// De kolommen die de hash dekken. taakinstantieId ontbreekt bij configuratie-events.
export type KetenRij = {
  taakinstantieId?: string;
  tijdstip: Date;
  actorType: string;
  actorId: string | null;
  actorNaam: string | null;
  rol: string | null;
  actie: string;
  entiteitType: string;
  entiteitId: string;
  details: unknown;
  correlatieId: string | null;
  vorigeHash: string | null;
};

export async function schrijfAuditEvent(tx: Prisma.TransactionClient, actor: AuditActor, event: AuditEventInvoer) {
  await vergrendelKeten(tx, `audit_event:${event.taakinstantieId}`);
  const vorige = await tx.auditEvent.findFirst({
    where: { taakinstantieId: event.taakinstantieId },
    orderBy: { id: "desc" },
    select: { hash: true },
  });
  const rij: KetenRij = {
    taakinstantieId: event.taakinstantieId,
    ...actorKolommen(actor),
    tijdstip: new Date(),
    actie: event.actie,
    entiteitType: event.entiteitType,
    entiteitId: event.entiteitId,
    details: event.details,
    correlatieId: randomUUID(),
    vorigeHash: vorige?.hash ?? null,
  };

  await tx.auditEvent.create({
    data: {
      ...rij,
      taakinstantieId: event.taakinstantieId,
      actorType: actor.type,
      rol: rij.rol as AppRole | null,
      details: event.details,
      hash: berekenHash(rij),
    },
  });
}

// Veel events van één taak tegelijk (bulkbesluiten, CC-10): één lock en één keer de vorige
// hash lezen, de keten in geheugen doorrekenen en in blokken invoegen. De ids volgen de
// volgorde van de invoer, dus de keten blijft in id-volgorde controleerbaar.
export async function schrijfAuditEvents(tx: Prisma.TransactionClient, actor: AuditActor, events: AuditEventInvoer[]) {
  if (events.length === 0) {
    return;
  }

  const taakinstantieId = events[0].taakinstantieId;

  if (events.some((event) => event.taakinstantieId !== taakinstantieId)) {
    throw new Error("schrijfAuditEvents: alle events moeten bij dezelfde taak horen.");
  }

  await vergrendelKeten(tx, `audit_event:${taakinstantieId}`);
  const vorige = await tx.auditEvent.findFirst({
    where: { taakinstantieId },
    orderBy: { id: "desc" },
    select: { hash: true },
  });
  let vorigeHash = vorige?.hash ?? null;
  const rijen = events.map((event) => {
    const rij: KetenRij = {
      taakinstantieId,
      ...actorKolommen(actor),
      tijdstip: new Date(),
      actie: event.actie,
      entiteitType: event.entiteitType,
      entiteitId: event.entiteitId,
      details: event.details,
      correlatieId: randomUUID(),
      vorigeHash,
    };
    const hash = berekenHash(rij);
    vorigeHash = hash;

    return {
      ...rij,
      taakinstantieId,
      actorType: actor.type,
      rol: rij.rol as AppRole | null,
      details: event.details,
      hash,
    };
  });

  for (let start = 0; start < rijen.length; start += 1_000) {
    await tx.auditEvent.createMany({ data: rijen.slice(start, start + 1_000) });
  }
}

export async function schrijfConfiguratieEvent(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  event: ConfiguratieEventInvoer
) {
  await vergrendelKeten(tx, "configuratie_event");
  const vorige = await tx.configuratieEvent.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
  const rij: KetenRij = {
    ...actorKolommen(actor),
    tijdstip: new Date(),
    actie: event.actie,
    entiteitType: event.entiteitType,
    entiteitId: event.entiteitId,
    details: event.details,
    correlatieId: randomUUID(),
    vorigeHash: vorige?.hash ?? null,
  };

  await tx.configuratieEvent.create({
    data: {
      ...rij,
      actorType: actor.type,
      rol: rij.rol as AppRole | null,
      details: event.details,
      hash: berekenHash(rij),
    },
  });
}

export type KetenFout = { id: string; reden: "hash" | "schakel" };

// Controleert een keten in volgorde van id: elke vorige_hash wijst naar de hash van het
// event ervoor, en elke hash klopt met de inhoud. Geeft de eerste afwijkingen terug.
export function controleerKeten(rijen: Array<KetenRij & { id: bigint; hash: string }>, vorigeHash: string | null = null) {
  const fouten: KetenFout[] = [];
  let verwacht = vorigeHash;

  for (const rij of rijen) {
    if (rij.vorigeHash !== verwacht) {
      fouten.push({ id: rij.id.toString(), reden: "schakel" });
    }
    if (berekenHash(rij) !== rij.hash) {
      fouten.push({ id: rij.id.toString(), reden: "hash" });
    }
    verwacht = rij.hash;
  }

  return { fouten, laatsteHash: verwacht };
}

export function berekenHash(rij: KetenRij) {
  const inhoud: Record<string, unknown> = {
    tijdstip: rij.tijdstip.toISOString(),
    actorType: rij.actorType,
    actorId: rij.actorId,
    actorNaam: rij.actorNaam,
    rol: rij.rol,
    actie: rij.actie,
    entiteitType: rij.entiteitType,
    entiteitId: rij.entiteitId,
    details: rij.details,
    correlatieId: rij.correlatieId,
    vorigeHash: rij.vorigeHash,
  };

  if (rij.taakinstantieId !== undefined) {
    inhoud.taakinstantieId = rij.taakinstantieId;
  }

  return createHash("sha256").update(canoniekeJson(inhoud)).digest("hex");
}

// JSON met gesorteerde sleutels, zodat de hash niet afhangt van de volgorde waarin
// PostgreSQL (jsonb) of JavaScript de sleutels teruggeeft.
export function canoniekeJson(waarde: unknown): string {
  if (waarde === null || typeof waarde !== "object") {
    return JSON.stringify(waarde ?? null);
  }

  if (Array.isArray(waarde)) {
    return `[${waarde.map((item) => canoniekeJson(item === undefined ? null : item)).join(",")}]`;
  }

  const velden = Object.entries(waarde as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([sleutel, item]) => `${JSON.stringify(sleutel)}:${canoniekeJson(item)}`);

  return `{${velden.join(",")}}`;
}

async function vergrendelKeten(tx: Prisma.TransactionClient, sleutel: string) {
  await tx.$queryRaw`SELECT 1 AS vergrendeld FROM pg_advisory_xact_lock(hashtext(${sleutel}::text))`;
}

function actorKolommen(actor: AuditActor) {
  return actor.type === "user"
    ? {
        actorType: "user",
        actorId: actor.user.sub,
        actorNaam: actor.user.name ?? actor.user.username ?? null,
        rol: actor.rol as string,
      }
    : {
        actorType: "system",
        actorId: "systeem",
        actorNaam: actor.naam ?? "Vernietigingscockpit",
        rol: null,
      };
}
