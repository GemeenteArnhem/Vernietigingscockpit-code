import type { AuditActie } from "../audit/audit-acties.js";

// Transitietabel van de taakinstantie: de enige plek waar staat welke statusovergangen
// bestaan. Bron: ui-spec/state/task-state-machine.md en ADR-0002 (status `vrijgegeven`,
// recordmanager geeft de vernietigingsopdracht).
//
// Statusovergangen gaan uitsluitend via WorkflowService.transition(), die deze tabel
// gebruikt. Persoons- en rolcontroles (functiescheiding) doen de services vóór de overgang.

export const TAAK_STATUSSEN = [
  "init",
  "beoordeling",
  "accordering_po",
  "accordering_archivaris",
  "vrijgegeven",
  "uitvoering",
  "resultaat",
  "archief",
] as const;

export type TaakStatus = (typeof TAAK_STATUSSEN)[number];

export type Transitie = {
  van: TaakStatus;
  naar: TaakStatus;
  // Wie de overgang uitvoert: een rol, of het systeem (worker).
  door: "recordmanager" | "proceseigenaar" | "archivaris" | "systeem";
  // Actienaam in het auditlog (ADR-0003).
  auditActie: AuditActie;
};

export const TRANSITIES = {
  "selectie.voltooid": { van: "init", naar: "beoordeling", door: "systeem", auditActie: "SELECTION_COMPLETED" },
  "beoordeling.voorleggen": {
    van: "beoordeling",
    naar: "accordering_po",
    door: "recordmanager",
    auditActie: "REVIEW_SUBMITTED",
  },
  "accordering_po.goedkeuren": {
    van: "accordering_po",
    naar: "accordering_archivaris",
    door: "proceseigenaar",
    auditActie: "APPROVAL_GRANTED",
  },
  "accordering_po.terugsturen": {
    van: "accordering_po",
    naar: "beoordeling",
    door: "proceseigenaar",
    auditActie: "APPROVAL_REJECTED",
  },
  "accordering_archivaris.vrijgeven": {
    van: "accordering_archivaris",
    naar: "vrijgegeven",
    door: "archivaris",
    auditActie: "DESTRUCTION_APPROVED_BY_ARCHIVIST",
  },
  "accordering_archivaris.terugsturen": {
    van: "accordering_archivaris",
    naar: "beoordeling",
    door: "archivaris",
    auditActie: "APPROVAL_REJECTED",
  },
  "vernietiging.opdracht_geven": {
    van: "vrijgegeven",
    naar: "uitvoering",
    door: "recordmanager",
    auditActie: "DESTRUCTION_ORDERED_BY_RM",
  },
  "uitvoering.voltooid": { van: "uitvoering", naar: "resultaat", door: "systeem", auditActie: "EXECUTION_COMPLETED" },
  archiveren: { van: "resultaat", naar: "archief", door: "recordmanager", auditActie: "TASK_COMPLETED" },
} as const satisfies Record<string, Transitie>;

export type TransitieActie = keyof typeof TRANSITIES;

// Terugsturen begint een nieuwe beoordelingsronde.
export function isTerugsturen(actie: TransitieActie) {
  return actie === "accordering_po.terugsturen" || actie === "accordering_archivaris.terugsturen";
}
