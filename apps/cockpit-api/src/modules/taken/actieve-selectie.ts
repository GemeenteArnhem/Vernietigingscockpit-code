// Selecties die meetellen voor een taak: niet vervangen door een herkansing (CC-16).
// Een vervangen selectie blijft voor het dossier bewaard, maar telt nergens meer mee.
export const ACTIEVE_SELECTIE = { status: { not: "VERVANGEN" } } as const;
