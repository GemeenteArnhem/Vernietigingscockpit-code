export type VernietigingsKandidaat = {
  id: string;
  titel: string;
  omvang: number;
  aantalObjecten: number;
  aantalBetrokkenen: number;

  bewaartermijn: number;
  vernietigingsdatum: string;

  beoordeeld?: boolean;
  uitgesloten: boolean;
  reden?: string;
  toelichting?: string;
  proceseigenaarToelichting?: string;
  archivarisToelichting?: string;
  beoordeling?: "OPGENOMEN" | "AKKOORD" | "UITGESLOTEN" | "RETOUR";

  // secundaire metadata
  bron_id?: string;
  code?: string;
  startdatum?: string;
  einddatum?: string;
  selectielijst?: string;
  grondslag?: string;
  bron_systeem?: string;
};
