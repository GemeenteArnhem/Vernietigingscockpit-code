export type ColumnKey =
  | "omvang"
  | "termijnLooptijd"
  | "termijnEinddatum"
  | "status"
  | "uitsluiten"
  | "toelichting"
  | "identificatie"
  | "classificatie"
  | "dekkingInTijd"
  | "selectielijst"
  | "informatiecategorie"
  | "stekker";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  omvang: "Omvang",
  termijnLooptijd: "Bewaartermijn",
  termijnEinddatum: "Einddatum bewaartermijn",
  status: "Status",
  uitsluiten: "Uitsluiten",
  toelichting: "Toelichting",
  identificatie: "Identificatie",
  classificatie: "Classificatie",
  dekkingInTijd: "Dekking in tijd",
  selectielijst: "Selectielijst",
  informatiecategorie: "Informatiecategorie",
  stekker: "Stekker",
};

export type ColumnGroup = {
  label: string;
  keys: ColumnKey[];
};

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    label: "Primaire kolommen",
    keys: ["omvang", "termijnLooptijd", "termijnEinddatum", "status", "uitsluiten", "toelichting"],
  },
  {
    label: "Metadata",
    keys: ["identificatie", "classificatie", "dekkingInTijd", "selectielijst", "informatiecategorie", "stekker"],
  },
];
