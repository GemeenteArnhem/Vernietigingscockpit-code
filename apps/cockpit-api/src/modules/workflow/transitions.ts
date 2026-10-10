import type { AuditEventType } from "../audit/audit-eventtypen.js";

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
  // Eventtype in het auditlog (ADR-0005 §5).
  eventType: AuditEventType;
  // Een tweede event direct na de overgang (door het systeem), bijv. Bevriezing van de lijst.
  vervolgEventType?: AuditEventType;
};

export const TRANSITIES = {
  "selectie.voltooid": { van: "init", naar: "beoordeling", door: "systeem", eventType: "Import" },
  "beoordeling.voorleggen": {
    van: "beoordeling",
    naar: "accordering_po",
    door: "recordmanager",
    eventType: "Voorgelegd",
  },
  "accordering_po.goedkeuren": {
    van: "accordering_po",
    naar: "accordering_archivaris",
    door: "proceseigenaar",
    eventType: "Accordering",
  },
  "accordering_po.terugsturen": {
    van: "accordering_po",
    naar: "beoordeling",
    door: "proceseigenaar",
    eventType: "Retour",
  },
  "accordering_archivaris.vrijgeven": {
    van: "accordering_archivaris",
    naar: "vrijgegeven",
    door: "archivaris",
    eventType: "Accordering",
    vervolgEventType: "Bevriezing",
  },
  "accordering_archivaris.terugsturen": {
    van: "accordering_archivaris",
    naar: "beoordeling",
    door: "archivaris",
    eventType: "Retour",
  },
  "vernietiging.opdracht_geven": {
    van: "vrijgegeven",
    naar: "uitvoering",
    door: "recordmanager",
    eventType: "Vernietigingsopdracht",
  },
  "uitvoering.voltooid": { van: "uitvoering", naar: "resultaat", door: "systeem", eventType: "Uitvoering afgerond" },
  archiveren: { van: "resultaat", naar: "archief", door: "recordmanager", eventType: "Export" },
} as const satisfies Record<string, Transitie>;

export type TransitieActie = keyof typeof TRANSITIES;

// Terugsturen begint een nieuwe beoordelingsronde.
export function isTerugsturen(actie: TransitieActie) {
  return actie === "accordering_po.terugsturen" || actie === "accordering_archivaris.terugsturen";
}
