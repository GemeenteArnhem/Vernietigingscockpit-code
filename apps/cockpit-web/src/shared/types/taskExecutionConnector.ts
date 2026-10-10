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
  icon?: ReactNode;
};

export type TaskExecutionDestructionConnector = Omit<
  TaskExecutionConnector,
  "selectieStatus"
> & {
  vernietigingsStatus: TaskExecutionConnectorDestructionStatus;
  // Wijze van vernietiging volgens de stekker (ADR-0005, B-M4).
  vernietigingsmethode: string;
  // Door de API bepaald, bijv. "vernietiging.opnieuw"; de UI leidt zelf geen rechten af.
  toegestaneActies: string[];
};
