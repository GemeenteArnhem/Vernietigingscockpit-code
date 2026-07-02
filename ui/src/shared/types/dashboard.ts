export type TaskExecutionStatus =
  | "VERTRAAGD"
  | "LOPEND"
  | "GEPLAND";

export type DashboardWorkflowStepId =
  | "SELECTIE"
  | "BEOORDELING"
  | "ACCORDERING_PO"
  | "ACCORDERING_ARCH"
  | "UITVOERING"
  | "RESULTAAT";

export type DashboardTaskRecord = {
  id: string;
  naam: string;
  subtitle: string;
  status: TaskExecutionStatus;
  eigenaar: "mijn" | "team";
  stapId: DashboardWorkflowStepId;
  stap: string;
  voortgang: number;
  dagenInStap: number;
  recordmanager: string;
  proceseigenaar: string;
  archivaris: string;
  startdatum: string;
  frequentie: string;
  dossierTelling: number;
};
