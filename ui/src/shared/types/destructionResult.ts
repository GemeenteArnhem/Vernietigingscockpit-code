export type DestructionResultStatus =
  | "SUCCES"
  | "FOUT"
  | "NIET_GEVONDEN"
  | "OVERIG";

export type DestructionResultAction =
  | "verklaring-downloaden"
  | "resultaat-exporteren"
  | "archiveren";

export type DestructionResultActionOption = {
  id: DestructionResultAction;
  title: string;
  description: string;
  tone: "primary" | "success" | "warning" | "danger" | "neutral";
};

export type DestructionResultRow = {
  id: string;
  titel: string;
  stekker: string;
  vernietigingsstatus: DestructionResultStatus;
  omvang?: number;
  vernietigingsdatum?: string;
  bron_id?: string;
  code?: string;
  grondslag?: string;
  bron_systeem?: string;
  melding?: string;
};

export type DestructionResultTaskContext = {
  procesnaam: string;
  recordmanager: string;
  proceseigenaar: string;
  archivaris: string;
  startdatum: string;
};

export type DestructionResultContext = {
  recordId: string;
  recordmanager: string;
  proceseigenaar: string;
  archivaris: string;
  startdatumTaak: string;
  bronSysteem: string;
  omvangLabel: string;
  statusDetail: string;
  vervolgstap: string;
  comments: import("./taskExecution").TaskExecutionComment[];
};
