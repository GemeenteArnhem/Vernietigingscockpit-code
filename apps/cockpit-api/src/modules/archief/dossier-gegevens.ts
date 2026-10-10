import type { Prisma } from "@prisma/client";
import { leesArchiefvormer } from "../taakdefinities/archiefvormer.js";
import { ACTIEVE_SELECTIE } from "../taken/actieve-selectie.js";
import type { MdtoBegrip, MdtoVerwijzing } from "./mdto-xml.js";

// Gegevens die de verklaring en de archivering allebei gebruiken. Ze lezen de kandidaten op
// dezelfde manier, zodat de MDTO-beschrijving per kandidaat in beide gelijk is (de SHA-256
// in de CSV-bijlage moet het bestand in het archiefpakket dekken).

export function leesDossierKandidaten(db: Prisma.TransactionClient, taakinstantieId: string) {
  return db.vernietigingskandidaat.findMany({
    where: { selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } },
    include: {
      uitvoeringsresultaten: true,
      selectie: {
        select: {
          stekkerConfiguratie: { select: { stekker: { select: { naam: true } } } },
          vernietiging: { select: { vernietigingsmethode: true } },
        },
      },
    },
    orderBy: [{ termijnEinddatum: "asc" }, { kandidaatId: "asc" }],
  });
}

export type DossierKandidaat = Awaited<ReturnType<typeof leesDossierKandidaten>>[number];

// De zorgdrager van het dossier: de archiefvormer die bij het aanmaken van de taak is
// vastgepind (ADR-0005, B-M3). Zonder archiefvormer is er geen geldig MDTO-dossier.
export function zorgdragerVan(taak: { id: string; archiefvormer: Prisma.JsonValue | null }): MdtoVerwijzing {
  const archiefvormer = leesArchiefvormer(taak.archiefvormer);

  if (!archiefvormer) {
    throw new Error(`Taak ${taak.id} heeft geen archiefvormer; het MDTO-dossier kan niet worden gemaakt.`);
  }

  return archiefvormer;
}

// Het label van de vernietigingsmethode die de stekker bij vrijgave meldde (B-M4).
export function vernietigingsmethodeVan(kandidaat: DossierKandidaat) {
  const methode = kandidaat.selectie.vernietiging?.vernietigingsmethode as MdtoBegrip | null | undefined;
  return methode?.begripLabel ?? null;
}
