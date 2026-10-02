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

  return acties;
}

export function taakinstantieActies(
  record: MedewerkerBoundRecord & {
    status: string;
    selecties?: Array<unknown>;
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

  if (isRecordmanager && record.status === "init" && selectieNogNietGestart) {
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

  return acties;
}
