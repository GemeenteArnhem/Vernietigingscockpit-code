import type { Prisma } from "@prisma/client";
import { leesArchiefvormer } from "./archiefvormer.js";
import { schrijfAuditEvent, type AuditActor } from "../audit/audit-keten.js";

// Planning van terugkerende taken. Een jaarlijkse, kwartaal- of maandelijkse taakdefinitie
// heeft steeds één klaargezette taakuitvoering in status 'init' met een geplande startdatum
// (`gepland_op`). Zolang die datum in de toekomst ligt, toont de UI 'Gepland' en kan de
// selectie nog niet starten. Er is geen extra taakstatus: de state machine blijft gelijk.
//
// Startdatum: de 1e van de maand.
// - jaarlijks: de startmaand; dit jaar als die maand nog moet komen of nu is, anders volgend jaar;
// - kwartaal: elke 3 maanden vanaf de startmaand; de eerstvolgende (huidige maand telt mee);
// - maandelijks: de 1e van de volgende maand.
// Na afronding (archief) volgt de volgende cyclus, na de vorige geplande datum.

export type Frequentie = "jaarlijks" | "kwartaal" | "maandelijks" | "ad_hoc";

export function isTerugkerend(frequentie: string): frequentie is Exclude<Frequentie, "ad_hoc"> {
  return frequentie === "jaarlijks" || frequentie === "kwartaal" || frequentie === "maandelijks";
}

// Eerstvolgende startdatum (UTC, 00:00) voor een eerste planning vanaf `vandaag`.
export function eersteStartdatum(frequentie: string, startmaand: number | null, vandaag: Date): Date | null {
  if (!isTerugkerend(frequentie)) {
    return null;
  }

  const jaar = vandaag.getUTCFullYear();
  const maand = vandaag.getUTCMonth() + 1;

  if (frequentie === "maandelijks") {
    return maandBegin(jaar, maand + 1);
  }

  return eerstvolgendeInCadans(frequentie, startmaandVan(startmaand), jaar, maand);
}

// Startdatum van de cyclus na `vorige` (strikt later), en niet in het verleden.
export function volgendeStartdatum(frequentie: string, startmaand: number | null, vorige: Date, vandaag: Date): Date | null {
  if (!isTerugkerend(frequentie)) {
    return null;
  }

  const stap = frequentie === "jaarlijks" ? 12 : frequentie === "kwartaal" ? 3 : 1;
  let datum = maandBegin(vorige.getUTCFullYear(), vorige.getUTCMonth() + 1 + stap);
  const ondergrens = maandBegin(vandaag.getUTCFullYear(), vandaag.getUTCMonth() + 1);

  // Lang niet afgerond: de gemiste cycli overslaan, maar binnen de cadans blijven.
  while (datum < ondergrens) {
    datum = maandBegin(datum.getUTCFullYear(), datum.getUTCMonth() + 1 + stap);
  }

  return datum;
}

// Naam van de uitvoering: "<definitie> 2027", "<definitie> Q3 2026" of "<definitie> november 2026".
export function naamVoorCyclus(definitieNaam: string, frequentie: string, startdatum: Date) {
  const jaar = startdatum.getUTCFullYear();
  const maand = startdatum.getUTCMonth();

  if (frequentie === "kwartaal") {
    return `${definitieNaam} Q${Math.floor(maand / 3) + 1} ${jaar}`;
  }

  if (frequentie === "maandelijks") {
    return `${definitieNaam} ${MAANDEN[maand]} ${jaar}`;
  }

  return `${definitieNaam} ${jaar}`;
}

// Geplande uitvoering aanmaken, met Creatie als begin van de auditketen. Bestaat er al een
// geplande, nog niet gestarte uitvoering voor deze definitie, dan gebeurt er niets.
export async function planUitvoering(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  definitie: {
    id: string;
    naam: string;
    frequentie: string;
    recordmanagerId: string;
    proceseigenaarId: string;
    archivarisId: string;
  },
  startdatum: Date
) {
  const bestaand = await tx.taakinstantie.count({
    where: { taakdefinitieId: definitie.id, status: "init", geplandOp: { not: null }, verwijderdOp: null },
  });

  if (bestaand > 0) {
    return null;
  }

  // Archiefvormer van de proceseigenaar vastpinnen. Ontbreekt hij (profiel gewijzigd), dan wordt
  // de cyclus niet gepland: geen dossier zonder archiefvormer.
  const proceseigenaar = await tx.medewerker.findUnique({
    where: { id: definitie.proceseigenaarId },
    select: { archiefvormer: true },
  });
  const archiefvormer = leesArchiefvormer(proceseigenaar?.archiefvormer);

  if (!archiefvormer) {
    return null;
  }

  const naam = naamVoorCyclus(definitie.naam, definitie.frequentie, startdatum);
  const taak = await tx.taakinstantie.create({
    data: {
      taakdefinitieId: definitie.id,
      naam,
      status: "init",
      archiefvormer,
      geplandOp: startdatum,
      // De selectieregels gelden op de geplande startdatum.
      peildatum: startdatum,
      recordmanagerId: definitie.recordmanagerId,
      proceseigenaarId: definitie.proceseigenaarId,
      archivarisId: definitie.archivarisId,
    },
    select: { id: true },
  });

  await schrijfAuditEvent(tx, actor, {
    taakinstantieId: taak.id,
    entiteitType: "taakinstantie",
    entiteitId: taak.id,
    eventType: "Creatie",
    details: {
      taakdefinitieId: definitie.id,
      naam,
      gepland: true,
      geplandOp: datumTekst(startdatum),
      peildatum: datumTekst(startdatum),
    },
  });

  return taak;
}

export function datumTekst(datum: Date) {
  return datum.toISOString().slice(0, 10);
}

// Is de uitvoering nog gepland (startdatum na vandaag)?
export function nogGepland(geplandOp: Date | null | undefined, nu: Date) {
  return geplandOp != null && geplandOp.getTime() > dagBegin(nu).getTime();
}

const MAANDEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

function startmaandVan(startmaand: number | null) {
  if (startmaand == null || !Number.isInteger(startmaand) || startmaand < 1 || startmaand > 12) {
    throw new Error("Een terugkerende taak (jaarlijks of kwartaal) heeft een startmaand (1-12) nodig.");
  }
  return startmaand;
}

function eerstvolgendeInCadans(frequentie: "jaarlijks" | "kwartaal", startmaand: number, jaar: number, maand: number) {
  const stap = frequentie === "jaarlijks" ? 12 : 3;
  // Eerste maand in de cadans die niet vóór de huidige maand ligt.
  let kandidaat = startmaand;
  while (kandidaat - stap >= maand) {
    kandidaat -= stap;
  }
  while (kandidaat < maand) {
    kandidaat += stap;
  }
  return maandBegin(jaar, kandidaat);
}

// Maand mag > 12 zijn (loopt door naar volgende jaren).
function maandBegin(jaar: number, maand: number) {
  return new Date(Date.UTC(jaar, maand - 1, 1));
}

function dagBegin(nu: Date) {
  return new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()));
}
