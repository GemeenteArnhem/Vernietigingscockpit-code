import type { DashboardWorkflowStepId } from "./types/dashboard";

// De bolletjes van de voortgangsbalk op het dashboard. Het laatste bolletje staat voor
// resultaat én archiveren: pas na archiveren zijn alle stappen afgerond.
export const DASHBOARD_STEPS: DashboardWorkflowStepId[] = [
  "SELECTIE",
  "BEOORDELING",
  "ACCORDERING_PO",
  "ACCORDERING_ARCH",
  "UITVOERING",
  "RESULTAAT",
];

// Voortgang = afgeronde stappen / alle stappen, zodat percentage en bolletjes nooit
// verschillen: 100% betekent alle bolletjes groen (gearchiveerd).
export function voortgangVanStap(stapId: DashboardWorkflowStepId, afgerond: boolean) {
  const afgerondeStappen = afgerond ? DASHBOARD_STEPS.length : Math.max(0, DASHBOARD_STEPS.indexOf(stapId));

  return Math.round((afgerondeStappen / DASHBOARD_STEPS.length) * 100);
}
