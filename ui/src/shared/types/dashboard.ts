export type TaskExecutionStatus =
  | "VERTRAAGD"
  | "LOPEND"
  | "GEPLAND";

export type DashboardTaskRecord = {
  id: string;
  naam: string;
  subtitle: string;
  status: TaskExecutionStatus;
  eigenaar: "mijn" | "team";
  stap: string;
  voortgang: number;
  dagenInStap: number;
  recordmanager: string;
  frequentie: string;
  dossierTelling: number;
};
