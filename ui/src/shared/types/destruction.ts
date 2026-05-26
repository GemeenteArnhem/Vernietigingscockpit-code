export type Status =
  | "OK"
  | "FOUT"
  | "OVERGESLAGEN"
  | "NIET_GEVONDEN";

export type VernietigingsObject = {
  id: string;
  titel: string;
  omvang: number;

  bewaartermijn: number;
  vernietigingsdatum: string;

  status?: Status;

  beoordeeld?: boolean;
  uitgesloten: boolean;
  reden?: string;
  toelichting?: string;
  proceseigenaarToelichting?: string;
  archivarisToelichting?: string;

  // secundaire metadata
  bron_id?: string;
  code?: string;
  startdatum?: string;
  einddatum?: string;
  selectielijst?: string;
  grondslag?: string;
  bron_systeem?: string;
};
