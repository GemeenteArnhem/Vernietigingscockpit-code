export type VernietigingsKandidaat = {
  id: string;
  naam: string;
  omvang: number;
  aantalObjecten: number;
  aantalBetrokkenen: number;

  termijnLooptijd: string;
  termijnEinddatum: string;

  beoordeeld?: boolean;
  uitgesloten: boolean;
  reden?: string;
  toelichting?: string;
  proceseigenaarToelichting?: string;
  archivarisToelichting?: string;
  beoordeling?: "OPGENOMEN" | "AKKOORD" | "UITGESLOTEN" | "RETOUR";

  // secundaire metadata
  // MDTO (ADR-0005): aggregatieniveau, waardering, identificaties als "kenmerk (bron)" en
  // de archiefvormer (van de kandidaat, anders die van de taak).
  aggregatieniveau?: string;
  waardering?: string;
  identificaties?: string[];
  archiefvormer?: string;
  identificatie?: string;
  classificatie?: string;
  dekkingInTijdBegindatum?: string;
  dekkingInTijdEinddatum?: string;
  selectielijst?: string;
  informatiecategorie?: string;
  stekker?: string;
};
