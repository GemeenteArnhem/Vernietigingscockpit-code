import { nogGepland } from "../taakdefinities/planning.js";

type Role = string;

type MedewerkerBoundRecord = {
  recordmanager: { id: string };
  proceseigenaar: { id: string };
  archivaris: { id: string };
};

export function taakdefinitieActies(
  record: MedewerkerBoundRecord,
  context: {
    roles: Role[];
    medewerkerId: string | null;
  }
) {
  const acties: string[] = [];
  const isRecordmanager =
    context.roles.includes("recordmanager") &&
    context.medewerkerId === record.recordmanager.id;

  if (isRecordmanager) {
    acties.push("taakdefinitie.bewerken", "taakinstantie.aanmaken");
  }

  if (
    context.roles.includes("functioneel_beheerder") ||
    context.roles.includes("auditor")
  ) {
    acties.push("taakdefinitie.lezen");
  }

  // De functioneel beheerder maakt uitvoeringen aan en verwijdert taken (zie
  // TaakdefinitiesService voor de voorwaarden bij het verwijderen).
  if (context.roles.includes("functioneel_beheerder")) {
    if (!acties.includes("taakinstantie.aanmaken")) {
      acties.push("taakinstantie.aanmaken");
    }
    acties.push("taakdefinitie.verwijderen");
  }

  return acties;
}

// Vanaf de vernietiging tot en met de archivering kan een uitvoering niet weg, en ook niet
// tijdens een lopende selectie.
const NIET_VERWIJDERBAAR = ["uitvoering", "resultaat"];
const LOPENDE_SELECTIE = ["AANGEVRAAGD", "RUNNING", "READY"];

function verwijderbaar(record: { status: string; selecties?: Array<unknown> }) {
  const selectieLoopt = (record.selecties ?? []).some(
    (selectie) => LOPENDE_SELECTIE.includes((selectie as { status?: string }).status ?? "")
  );
  return !NIET_VERWIJDERBAAR.includes(record.status) && !selectieLoopt;
}

export function taakinstantieActies(
  record: MedewerkerBoundRecord & {
    status: string;
    selecties?: Array<unknown>;
    // Geplande startdatum (terugkerende taken): vóór die datum geen selectie.
    geplandOp?: Date | null;
  },
  context: {
    roles: Role[];
    medewerkerId: string | null;
  }
) {
  const acties: string[] = [];
  const isRecordmanager =
    context.roles.includes("recordmanager") &&
    context.medewerkerId === record.recordmanager.id;
  const selectieNogNietGestart = (record.selecties?.length ?? 0) === 0;

  if (isRecordmanager && record.status === "init" && selectieNogNietGestart && !nogGepland(record.geplandOp, new Date())) {
    acties.push("selectie.starten");
  }

  if (isRecordmanager && record.status === "beoordeling") {
    acties.push("kandidaat.beoordelen", "beoordeling.voorleggen");
  }

  if (
    context.roles.includes("proceseigenaar") &&
    context.medewerkerId === record.proceseigenaar.id &&
    record.status === "accordering_po"
  ) {
    acties.push("accordering_po.besluiten");
  }

  if (
    context.roles.includes("archivaris") &&
    context.medewerkerId === record.archivaris.id &&
    record.status === "accordering_archivaris"
  ) {
    acties.push("accordering_archivaris.besluiten");
  }

  if (isRecordmanager && record.status === "vrijgegeven") {
    acties.push("vernietiging.opdracht_geven");
  }

  if (context.roles.includes("functioneel_beheerder") && verwijderbaar(record)) {
    acties.push("taakinstantie.verwijderen");
  }

  return acties;
}
