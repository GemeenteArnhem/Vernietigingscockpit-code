import type { ReactNode } from "react";

export type TaskExecutionConnectorStatus = "SUCCES" | "FOUT";

export type TaskExecutionConnectorSelectionStatus =
  | "NIET_GESTART"
  | "BEZIG"
  | "VOLTOOID"
  | "GEDEELTELIJK_VOLTOOID";

export type TaskExecutionConnectorDestructionStatus =
  | "NIET_GESTART"
  | "BEZIG"
  | "VOLTOOID"
  | "GEDEELTELIJK_VOLTOOID";

export type TaskExecutionConnector = {
  id: string;
  naam: string;
  versie: string;
  stekkerStatus: TaskExecutionConnectorStatus;
  selectieStatus: TaskExecutionConnectorSelectionStatus;
  voortgang: number;
  laatsteRun: string;
  aantalObjecten: string;
  melding: string;
  icon: ReactNode;
};

export type TaskExecutionDestructionConnector = Omit<
  TaskExecutionConnector,
  "selectieStatus"
> & {
  vernietigingsStatus: TaskExecutionConnectorDestructionStatus;
};
