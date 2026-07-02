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
  omvangClienten?: number;
  bewaartermijn?: number;
  vernietigingsdatum?: string;
  bron_id?: string;
  code?: string;
  startdatum?: string;
  einddatum?: string;
  selectielijst?: string;
  grondslag?: string;
  bron_systeem?: string;
  melding?: string;
};

export type DestructionResultColumnKey =
  | "omvang"
  | "vernietigingsdatum"
  | "bron_id"
  | "code"
  | "grondslag"
  | "bron_systeem"
  | "melding";

export const DESTRUCTION_RESULT_COLUMN_LABELS: Record<
  DestructionResultColumnKey,
  string
> = {
  omvang: "Omvang",
  vernietigingsdatum: "Vernietigingsdatum",
  bron_id: "Bron-ID",
  code: "Code",
  grondslag: "Grondslag",
  bron_systeem: "Bronsysteem",
  melding: "Melding",
};

export const DESTRUCTION_RESULT_COLUMN_GROUPS: {
  label: string;
  keys: DestructionResultColumnKey[];
}[] = [
  {
    label: "Recordgegevens",
    keys: ["omvang", "vernietigingsdatum", "bron_id"],
  },
  {
    label: "Context",
    keys: ["code", "grondslag", "bron_systeem", "melding"],
  },
];

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
