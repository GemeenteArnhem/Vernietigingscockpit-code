export type ColumnKey =
  | "omvang"
  | "bewaartermijn"
  | "vernietigingsdatum"
  | "status"
  | "uitsluiten"
  | "toelichting"
  | "bron_id"
  | "code"
  | "periode"
  | "selectielijst"
  | "grondslag"
  | "bron_systeem";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  omvang: "Omvang",
  bewaartermijn: "Bewaartermijn",
  vernietigingsdatum: "Vernietigingsdatum",
  status: "Status",
  uitsluiten: "Uitsluiten",
  toelichting: "Toelichting",
  bron_id: "Bron-ID",
  code: "Code",
  periode: "Periode",
  selectielijst: "Selectielijst",
  grondslag: "Grondslag",
  bron_systeem: "Bronsysteem",
};

export type ColumnGroup = {
  label: string;
  keys: ColumnKey[];
};

export const COLUMN_GROUPS: ColumnGroup[] = [
  {
    label: "Primaire kolommen",
    keys: ["omvang", "bewaartermijn", "vernietigingsdatum", "status", "uitsluiten", "toelichting"],
  },
  {
    label: "Metadata",
    keys: ["bron_id", "code", "periode", "selectielijst", "grondslag", "bron_systeem"],
  },
];
