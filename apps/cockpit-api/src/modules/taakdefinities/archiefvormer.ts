import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

// Archiefvormer (MDTO verwijzingGegevens) van de proceseigenaar: staat op diens profiel en komt
// mee in de stamgegevens-import (ADR-0005, B-M3, besluit 2026-10-09). Een taakdefinitie vraagt
// een proceseigenaar met archiefvormer; een taakuitvoering pint hem vast bij het aanmaken.

export type Archiefvormer = {
  verwijzingNaam: string;
  verwijzingIdentificatie?: { identificatieKenmerk: string; identificatieBron: string };
};

export function leesArchiefvormer(waarde: Prisma.JsonValue | null | undefined): Archiefvormer | null {
  const verwijzing = waarde as { verwijzingNaam?: unknown } | null | undefined;
  return verwijzing && typeof verwijzing.verwijzingNaam === "string" && verwijzing.verwijzingNaam.trim()
    ? (waarde as Archiefvormer)
    : null;
}

// De archiefvormer van de proceseigenaar, of een 400 als die ontbreekt.
export async function archiefvormerVanProceseigenaar(tx: Prisma.TransactionClient, proceseigenaarId: string) {
  const proceseigenaar = await tx.medewerker.findUnique({
    where: { id: proceseigenaarId },
    select: { naam: true, archiefvormer: true },
  });
  const archiefvormer = leesArchiefvormer(proceseigenaar?.archiefvormer);

  if (!archiefvormer) {
    throw new BadRequestException(
      `Proceseigenaar ${proceseigenaar?.naam ?? proceseigenaarId} heeft geen archiefvormer in het profiel. Vul die aan via de stamgegevens-import.`
    );
  }

  return archiefvormer;
}
