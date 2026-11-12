import type { ApiOpmerking } from "@vernietigingscockpit/api-contract";
import type { BesluitRol } from "./taken-hulp.js";

// Opmerkingen per kandidaat (besluit 2026-11-12): elke toelichting bij een beoordeling of
// besluit is een eigen regel van de auteur. Alleen de auteur verwijdert hem, logisch, en
// alleen in de eigen stap en ronde: na doorzetten of vrijgave ligt hij vast.

// De taakstatus waarin elke rol opmerkingen maakt (en de eigen opmerkingen kan verwijderen).
export const STAP_VAN_ROL: Record<BesluitRol, string> = {
  recordmanager: "beoordeling",
  proceseigenaar: "accordering_po",
  archivaris: "accordering_archivaris",
};

// Voor Prisma `include`: de zichtbare opmerkingen met de naam van de auteur, oudste eerst.
export const OPMERKINGEN_INCLUDE = {
  where: { verwijderdOp: null },
  orderBy: { tijdstip: "asc" },
  include: { medewerker: { select: { id: true, naam: true } } },
} as const;

type Opmerking = {
  id: string;
  rol: string;
  ronde: number;
  tekst: string;
  tijdstip: Date;
  medewerkerId: string;
  medewerker: { id: string; naam: string };
};

type Kandidaat = { beoordeling: string; beoordeeldOp: Date | null };

export type OpmerkingContext = {
  taak: { status: string; ronde: number };
  // De ingelogde medewerker; null = niemand mag verwijderen (bijv. auditor of resultaatpagina).
  medewerkerId: string | null;
};

export type VerwijderBezwaar = "andere_stap" | "uitsluiting";

// Waarom de auteur deze opmerking nu niet mag verwijderen, of null als het wel mag.
// Of de gebruiker de auteur is, controleert de aanroeper.
export function verwijderBezwaar(opmerking: Omit<Opmerking, "medewerker">, kandidaat: Kandidaat, taak: OpmerkingContext["taak"]): VerwijderBezwaar | null {
  if (STAP_VAN_ROL[opmerking.rol as BesluitRol] !== taak.status || opmerking.ronde !== taak.ronde) {
    return "andere_stap";
  }

  // De verplichte toelichting bij de huidige uitsluiting blijft staan; hij is in dezelfde
  // transactie geschreven als de beoordeling en heeft dus hetzelfde tijdstip.
  if (
    opmerking.rol === "recordmanager" &&
    kandidaat.beoordeling === "UITGESLOTEN" &&
    kandidaat.beoordeeldOp?.getTime() === opmerking.tijdstip.getTime()
  ) {
    return "uitsluiting";
  }

  return null;
}

export function opmerkingenWeergave(
  kandidaat: Kandidaat & { opmerkingen: Opmerking[] },
  context: OpmerkingContext
): ApiOpmerking[] {
  return kandidaat.opmerkingen.map((opmerking) => ({
    id: opmerking.id,
    rol: opmerking.rol as BesluitRol,
    medewerker: opmerking.medewerker,
    ronde: opmerking.ronde,
    tekst: opmerking.tekst,
    tijdstip: opmerking.tijdstip.toISOString(),
    verwijderbaar:
      context.medewerkerId !== null &&
      opmerking.medewerkerId === context.medewerkerId &&
      verwijderBezwaar(opmerking, kandidaat, context.taak) === null,
  }));
}
