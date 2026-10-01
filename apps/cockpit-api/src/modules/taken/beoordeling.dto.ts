export type KandidaatBeoordeling = "AKKOORD" | "UITGESLOTEN";

export type UpdateKandidaatBeoordelingInput = {
  beoordeling: KandidaatBeoordeling;
  uitsluitReden?: string | null;
  toelichting?: string | null;
};
