import type { Prisma } from "@prisma/client";
import { ACTIEVE_SELECTIE } from "../taken/actieve-selectie.js";

// Selectielijstcodes van de taak die bij import niet in het register stonden, met het aantal
// kandidaten per code. Ze komen als waarschuwing in het Import-event (ADR-0008, DR-SL-06).
export async function onbekendeSelectielijstcodes(tx: Prisma.TransactionClient, taakinstantieId: string) {
  const groepen = await tx.vernietigingskandidaat.groupBy({
    by: ["selectielijstCode"],
    where: { selectielijstBekend: false, selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } },
    _count: { _all: true },
    orderBy: { selectielijstCode: "asc" },
  });

  return groepen.map((groep) => ({ code: groep.selectielijstCode, aantal: groep._count._all }));
}
