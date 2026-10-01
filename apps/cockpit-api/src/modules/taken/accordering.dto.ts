export type AccorderingBesluit = "AKKOORD" | "RETOUR";

export type UpdateProceseigenaarAccorderingInput = {
  besluit: AccorderingBesluit;
  toelichting?: string | null;
};
