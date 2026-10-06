-- CC-8: de uitvoering krijgt eigen tabellen. De velden vernietiging_* en het JSON-blob op
-- selectie vervallen. Afgesproken: geen omzetting van bestaande data (database is leeg na
-- ADR-0003); de migratie stopt als er toch uitvoeringsdata staat.
DO $$
DECLARE
  aantal bigint;
BEGIN
  SELECT count(*) INTO aantal FROM "selectie"
  WHERE "extern_vernietiging_id" IS NOT NULL
     OR "vernietiging_status" IS NOT NULL
     OR "vernietiging_resultaat" IS NOT NULL;

  IF aantal > 0 THEN
    RAISE EXCEPTION '% selectie(s) bevatten uitvoeringsdata (vernietiging_*). CC-8 zet die niet om: bouw de database opnieuw op en draai daarna de migraties.', aantal;
  END IF;
END $$;

ALTER TABLE "selectie"
  DROP COLUMN "extern_vernietiging_id",
  DROP COLUMN "vernietiging_status",
  DROP COLUMN "vernietiging_gestart_op",
  DROP COLUMN "vernietiging_afgerond_op",
  DROP COLUMN "vernietiging_resultaat";

CREATE TABLE "vernietiging" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taakinstantie_id" uuid NOT NULL REFERENCES "taakinstantie"("id"),
  "selectie_id" uuid NOT NULL UNIQUE REFERENCES "selectie"("id"),
  "besluit_referentie" text NOT NULL,
  "batch_grootte" integer NOT NULL CHECK ("batch_grootte" BETWEEN 1 AND 1000),
  "aantal_kandidaten" integer NOT NULL CHECK ("aantal_kandidaten" > 0),
  "status" text NOT NULL DEFAULT 'LOPEND'
    CHECK ("status" IN ('LOPEND', 'MISLUKT', 'INTEGRITEIT_MISLUKT', 'AFGEROND')),
  "extern_vernietiging_id" text,
  "stekker_status" text
    CHECK ("stekker_status" IN ('IDLE', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  "vrijgegeven_op" timestamptz,
  "stekker_starttijd" timestamptz,
  "stekker_eindtijd" timestamptz,
  "volgende_poll_op" timestamptz,
  "poll_pogingen" integer NOT NULL DEFAULT 0,
  "fout" text,
  "aangemaakt_op" timestamptz NOT NULL DEFAULT now(),
  "afgerond_op" timestamptz,
  "geclaimd_tot" timestamptz,
  "geclaimd_door" text
);
CREATE INDEX "vernietiging_taakinstantie_id_idx" ON "vernietiging"("taakinstantie_id");
CREATE INDEX "idx_vernietiging_poll" ON "vernietiging"("volgende_poll_op") WHERE "status" = 'LOPEND';

CREATE TABLE "vernietiging_batch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vernietiging_id" uuid NOT NULL REFERENCES "vernietiging"("id"),
  "batch_nummer" integer NOT NULL CHECK ("batch_nummer" > 0),
  "aantal" integer NOT NULL CHECK ("aantal" > 0),
  "geaccepteerd_op" timestamptz,
  CONSTRAINT "vernietiging_batch_vernietiging_id_batch_nummer_key" UNIQUE ("vernietiging_id", "batch_nummer")
);

CREATE TABLE "uitvoeringsresultaat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vernietiging_id" uuid NOT NULL REFERENCES "vernietiging"("id"),
  "batch_id" uuid NOT NULL REFERENCES "vernietiging_batch"("id"),
  "kandidaat_id" uuid NOT NULL REFERENCES "vernietigingskandidaat"("id"),
  "resultaat" text CHECK ("resultaat" IN ('SUCCESS', 'FAILED', 'SKIPPED', 'NOT_FOUND', 'CHANGED')),
  "foutcode" text,
  "foutmelding" text,
  "bronstatus" text,
  "log_reference" text,
  "correlatie_id" text,
  "ontvangen_op" timestamptz,
  CONSTRAINT "uitvoeringsresultaat_vernietiging_id_kandidaat_id_key" UNIQUE ("vernietiging_id", "kandidaat_id")
);
CREATE INDEX "uitvoeringsresultaat_batch_id_idx" ON "uitvoeringsresultaat"("batch_id");
