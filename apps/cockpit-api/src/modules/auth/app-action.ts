import type { AppRole } from "./app-role.js";

export const APP_ACTIONS = [
  "taakdefinitie.beheren",
  "selectie.starten",
  "kandidaat.beoordelen",
  "beoordeling.voorleggen",
  "accordering_po.besluiten",
  "accordering_archivaris.besluiten",
  "vernietiging.opdracht_geven",
  "stekker.beheren",
  "audit.lezen",
] as const;

export type AppAction = (typeof APP_ACTIONS)[number];

const ACTIONS_BY_ROLE: Record<AppRole, AppAction[]> = {
  recordmanager: [
    "taakdefinitie.beheren",
    "selectie.starten",
    "kandidaat.beoordelen",
    "beoordeling.voorleggen",
    "vernietiging.opdracht_geven",
  ],
  proceseigenaar: ["accordering_po.besluiten"],
  archivaris: ["accordering_archivaris.besluiten"],
  functioneel_beheerder: ["stekker.beheren"],
  auditor: ["audit.lezen"],
};

export function actionsForRoles(roles: AppRole[]) {
  return Array.from(
    new Set(roles.flatMap((role) => ACTIONS_BY_ROLE[role]))
  ).sort();
}
