export type TaskDefinitionExecutionStatus =
  | "GEPLAND"
  | "LOPEND"
  | "VOLTOOID"
  | "VERTRAAGD";

export type TaskDefinitionConnectorStatus =
  | "GEKOPPELD"
  | "ACTIEF_CONNECTOR"
  | "INACTIEF"
  | "FOUT"
  | "WAARSCHUWING"
  | "SUCCES";

export type TaskDefinitionConnector = {
  id?: string;
  naam: string;
  type: string;
  omschrijving?: string;
  status: TaskDefinitionConnectorStatus;
};

export type TaskDefinitionInstance = {
  id: string;
  naam: string;
  subtitle: string;
  startdatum: string;
  recordmanager: string;
  status: TaskDefinitionExecutionStatus;
  stap: string;
  voortgang: number;
  plannedStartDate?: string;
  highlighted?: boolean;
};

export type TaskDefinitionRecord = {
  id: string;
  naam: string;
  subtitle: string;
  categorie: string;
  frequentie: string;
  proceseigenaar: string;
  archivaris: string;
  instanties: TaskDefinitionInstance[];
  stekkers: TaskDefinitionConnector[];
};
