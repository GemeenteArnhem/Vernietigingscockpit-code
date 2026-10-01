CREATE TABLE "vernietigingskandidaat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "selectie_id" uuid NOT NULL REFERENCES "selectie"("id"),
  "kandidaat_id" text NOT NULL,
  "bron_id" text NOT NULL,
  "bron_id_naam" text,
  "omschrijving" text NOT NULL,
  "classificatieschema" text,
  "classificatiesleutel" text,
  "classificatieomschrijving" text,
  "selectielijst" text,
  "grondslag" text,
  "grondslag_afwijkend" text,
  "resultaat" text,
  "bewaartermijn" text,
  "waardering" text,
  "begindatum" date,
  "einddatum" date,
  "vernietigingsdatum" date,
  "aantal_objecten" integer NOT NULL DEFAULT 0,
  "aantal_betrokkenen" integer NOT NULL DEFAULT 0,
  "relatie_type" text,
  "relatie_id" text,
  "bron" jsonb NOT NULL,
  "beoordeling" text NOT NULL DEFAULT 'OPGENOMEN',
  "uitsluit_reden" text,
  "toelichting" text,
  "beoordeeld_door" uuid,
  "versie" integer NOT NULL DEFAULT 1,
  UNIQUE ("selectie_id", "kandidaat_id")
);

CREATE INDEX "idx_vernietigingskandidaat_selectie_beoordeling"
  ON "vernietigingskandidaat"("selectie_id", "beoordeling");

CREATE INDEX "idx_vernietigingskandidaat_vernietigingsdatum"
  ON "vernietigingskandidaat"("vernietigingsdatum");

CREATE INDEX "idx_vernietigingskandidaat_grondslag"
  ON "vernietigingskandidaat"("grondslag");
