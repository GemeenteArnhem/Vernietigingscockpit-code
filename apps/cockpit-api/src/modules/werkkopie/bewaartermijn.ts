import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfConfiguratieEvent, type AuditActor } from "../audit/audit-keten.js";

// De bewaartermijn van de werkkopie (ADR-0006 §2.4): ISO 8601-duur, gerekend vanaf de
// geslaagde archivering. De waarde staat in de tabel `instelling`, zodat ook de database
// (verwijder_werkkopie) hem kent. WERKKOPIE_BEWAARTERMIJN (standaard P12M) is de
// beginwaarde; de functioneel beheerder wijzigt hem via de beheer-API. Elke wijziging, ook
// het vastleggen van de beginwaarde, staat als 'Instelling gewijzigd' in het configuratielog.

export const SLEUTEL_BEWAARTERMIJN = "werkkopie_bewaartermijn";
export const STANDAARD_BEWAARTERMIJN = "P12M";

// Dezelfde vorm als de CHECK-constraint in de migratie (PostgreSQL leest dit als interval).
export const ISO_DUUR = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;

export function beginwaarde(env: string | undefined) {
  const waarde = env?.trim() || STANDAARD_BEWAARTERMIJN;

  if (!ISO_DUUR.test(waarde)) {
    throw new Error(`WERKKOPIE_BEWAARTERMIJN moet een ISO 8601-duur zijn (bijv. P12M of P0D), niet '${waarde}'.`);
  }

  return waarde;
}

export async function leesBewaartermijn(db: Prisma.TransactionClient, standaard: string) {
  const instelling = await db.instelling.findUnique({ where: { sleutel: SLEUTEL_BEWAARTERMIJN } });

  return instelling
    ? { waarde: instelling.waarde, bron: "instelling" as const, gewijzigdOp: instelling.gewijzigdOp.toISOString() }
    : { waarde: standaard, bron: "standaard" as const, gewijzigdOp: null };
}

export async function zetBewaartermijn(tx: Prisma.TransactionClient, actor: AuditActor, waarde: string, toelichting?: string) {
  if (!ISO_DUUR.test(waarde)) {
    throw new BadRequestException("De bewaartermijn moet een ISO 8601-duur zijn, bijvoorbeeld P12M, P2Y of P0D.");
  }

  await tx.$queryRaw`SELECT 1 AS vergrendeld FROM pg_advisory_xact_lock(hashtext(${`instelling:${SLEUTEL_BEWAARTERMIJN}`}::text))`;
  const oud = await tx.instelling.findUnique({ where: { sleutel: SLEUTEL_BEWAARTERMIJN } });

  if (oud?.waarde === waarde) {
    return oud;
  }

  const gewijzigdDoor = actor.type === "user" ? actor.user.sub : "systeem";
  const nieuw = await tx.instelling.upsert({
    where: { sleutel: SLEUTEL_BEWAARTERMIJN },
    create: { sleutel: SLEUTEL_BEWAARTERMIJN, waarde, gewijzigdDoor },
    update: { waarde, gewijzigdDoor, gewijzigdOp: new Date() },
  });

  await schrijfConfiguratieEvent(tx, actor, {
    eventType: "Instelling gewijzigd",
    entiteitType: "instelling",
    entiteitId: SLEUTEL_BEWAARTERMIJN,
    details: { sleutel: SLEUTEL_BEWAARTERMIJN, oud: oud?.waarde ?? null, nieuw: waarde, ...(toelichting ? { toelichting } : {}) },
  });

  return nieuw;
}

// Zonder vastgelegde waarde: de beginwaarde uit de omgeving vastleggen (door het systeem).
export async function borgBewaartermijn(prisma: PrismaService, actor: AuditActor, standaard: string) {
  if (await prisma.client.instelling.findUnique({ where: { sleutel: SLEUTEL_BEWAARTERMIJN } })) {
    return;
  }

  await prisma.client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS vergrendeld FROM pg_advisory_xact_lock(hashtext(${`instelling:${SLEUTEL_BEWAARTERMIJN}`}::text))`;
    if (!(await tx.instelling.findUnique({ where: { sleutel: SLEUTEL_BEWAARTERMIJN } }))) {
      await zetBewaartermijn(tx, actor, standaard, "Beginwaarde uit WERKKOPIE_BEWAARTERMIJN");
    }
  });
}
