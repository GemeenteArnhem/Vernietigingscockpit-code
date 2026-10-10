import { createHash } from "node:crypto";
import type { DossierGrafsteen, Prisma } from "@prisma/client";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { canoniekeJson } from "../audit/audit-keten.js";

// Grafsteen van een verwijderde werkkopie (ADR-0006 §5): één globale hashketen, net als
// configuratie_event. hash = SHA-256 over canonieke JSON van alle kolommen behalve id en hash.

export type GrafsteenInvoer = Omit<DossierGrafsteen, "id" | "verwijderdOp" | "vorigeHash" | "hash">;

type GrafsteenRij = Omit<DossierGrafsteen, "id" | "hash">;

export function berekenGrafsteenHash(rij: GrafsteenRij) {
  const datum = (waarde: Date | null) => waarde?.toISOString() ?? null;

  return createHash("sha256")
    .update(
      canoniekeJson({
        ...rij,
        afgerondOp: datum(rij.afgerondOp),
        gearchiveerdOp: datum(rij.gearchiveerdOp),
        verwijderdOp: datum(rij.verwijderdOp),
      })
    )
    .digest("hex");
}

// Schrijft de grafsteen in de lopende transactie. verwijderd_op is now() van de transactie,
// op milliseconden (zoals JavaScript hem kent); daarop controleert verwijder_werkkopie()
// dat de grafsteen in dezelfde transactie staat.
export async function schrijfGrafsteen(tx: Prisma.TransactionClient, invoer: GrafsteenInvoer) {
  await tx.$queryRaw`SELECT 1 AS vergrendeld FROM pg_advisory_xact_lock(hashtext(${"dossier_grafsteen"}::text))`;
  const [{ nu }] = await tx.$queryRaw<Array<{ nu: Date }>>`SELECT date_trunc('milliseconds', now()) AS nu`;
  const vorige = await tx.dossierGrafsteen.findFirst({ orderBy: { id: "desc" }, select: { hash: true } });
  const rij: GrafsteenRij = { ...invoer, verwijderdOp: nu, vorigeHash: vorige?.hash ?? null };

  return tx.dossierGrafsteen.create({
    data: {
      ...rij,
      archiefvormer: rij.archiefvormer as Prisma.InputJsonValue,
      verificatie: rij.verificatie as Prisma.InputJsonValue,
      hash: berekenGrafsteenHash(rij),
    },
  });
}

// Loopt de grafsteenketen na: schakels en hashes (GET /dossiers/grafstenen/verificatie).
export async function verifieerGrafstenen(prisma: PrismaService) {
  const fouten: Array<{ id: string; reden: "hash" | "schakel" }> = [];
  let verwacht: string | null = null;
  let aantal = 0;
  let vanafId: bigint | undefined;

  for (;;) {
    const blok: DossierGrafsteen[] = await prisma.client.dossierGrafsteen.findMany({
      where: vanafId !== undefined ? { id: { gt: vanafId } } : {},
      orderBy: { id: "asc" },
      take: 1000,
    });

    if (blok.length === 0) {
      break;
    }

    for (const { id, hash, ...rij } of blok) {
      if (rij.vorigeHash !== verwacht) {
        fouten.push({ id: id.toString(), reden: "schakel" });
      }
      if (berekenGrafsteenHash(rij) !== hash) {
        fouten.push({ id: id.toString(), reden: "hash" });
      }
      verwacht = hash;
    }

    aantal += blok.length;
    vanafId = blok[blok.length - 1].id;
  }

  return { intact: fouten.length === 0, aantal, laatsteHash: verwacht, fouten: fouten.slice(0, 50) };
}
