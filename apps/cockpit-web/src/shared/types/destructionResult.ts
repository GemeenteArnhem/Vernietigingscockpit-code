export type DestructionResultStatus =
  | "SUCCESS"
  | "FAILED"
  | "NOT_FOUND"
  | "SKIPPED"
  | "CHANGED";

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
  naam: string;
  stekker: string;
  resultaat: DestructionResultStatus;
  omvang?: number;
  aantalBetrokkenen?: number;
  termijnLooptijd?: string;
  termijnEinddatum?: string;
  identificatie?: string;
  classificatie?: string;
  dekkingInTijdBegindatum?: string;
  dekkingInTijdEinddatum?: string;
  selectielijst?: string;
  informatiecategorie?: string;
  // MDTO (ADR-0005): aggregatieniveau, waardering, identificaties als "kenmerk (bron)" en
  // de archiefvormer (van de kandidaat, anders die van de taak).
  aggregatieniveau?: string;
  waardering?: string;
  identificaties?: string[];
  archiefvormer?: string;
  // Tijdstip van vernietiging (MDTO eventTijd) en vernietigingsmethode van de stekker.
  eventTijd?: string;
  eventTijdIso?: string;
  vernietigingsmethode?: string;
  melding?: string;
};

export type DestructionResultColumnKey =
  | "omvang"
  | "termijnEinddatum"
  | "identificatie"
  | "classificatie"
  | "informatiecategorie"
  | "stekker"
  | "aggregatieniveau"
  | "waardering"
  | "eventTijd"
  | "melding";

export const DESTRUCTION_RESULT_COLUMN_LABELS: Record<
  DestructionResultColumnKey,
  string
> = {
  omvang: "Omvang",
  termijnEinddatum: "Einddatum bewaartermijn",
  identificatie: "Identificatie",
  classificatie: "Classificatie",
  informatiecategorie: "Informatiecategorie",
  stekker: "Stekker",
  aggregatieniveau: "Aggregatieniveau",
  waardering: "Waardering",
  eventTijd: "Tijdstip vernietiging",
  melding: "Melding",
};

export const DESTRUCTION_RESULT_COLUMN_GROUPS: {
  label: string;
  keys: DestructionResultColumnKey[];
}[] = [
  {
    label: "Recordgegevens",
    keys: ["omvang", "termijnEinddatum", "identificatie"],
  },
  {
    label: "Context",
    keys: ["classificatie", "informatiecategorie", "stekker", "melding"],
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
