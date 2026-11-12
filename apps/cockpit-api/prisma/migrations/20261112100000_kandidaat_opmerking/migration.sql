-- Opmerkingen per kandidaat (besluit 2026-11-12): elke toelichting van recordmanager,
-- proceseigenaar of archivaris is een eigen regel met medewerker, rol, ronde en tijdstip,
-- zodat alle opmerkingen zichtbaar blijven en niemand de opmerking van een ander overschrijft.
-- Verwijderen is logisch (verwijderd_op/verwijderd_door) en alleen door de auteur zelf.
-- Bestaande toelichtingen worden niet omgezet (besluit 2026-11-12: lege database), dus de
-- migratie stopt als er al kandidaten zijn.
DO $$
DECLARE
  aantal bigint;
BEGIN
  SELECT count(*) INTO aantal FROM "vernietigingskandidaat";
  IF aantal > 0 THEN
    RAISE EXCEPTION 'Er zijn % vernietigingskandidaat/-kandidaten. kandidaat_opmerking zet bestaande toelichtingen niet om: bouw de database opnieuw op en draai daarna de migraties.', aantal;
  END IF;
END $$;

CREATE TABLE "kandidaat_opmerking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kandidaat_id" uuid NOT NULL REFERENCES "vernietigingskandidaat"("id") ON DELETE CASCADE,
  "taakinstantie_id" uuid NOT NULL REFERENCES "taakinstantie"("id"),
  "ronde" integer NOT NULL CHECK ("ronde" > 0),
  "rol" text NOT NULL CHECK ("rol" IN ('recordmanager', 'proceseigenaar', 'archivaris')),
  "tekst" text NOT NULL CHECK (length(btrim("tekst")) > 0),
  "medewerker_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "tijdstip" timestamptz NOT NULL DEFAULT now(),
  "verwijderd_op" timestamptz,
  "verwijderd_door" uuid REFERENCES "medewerker"("id"),
  CHECK (("verwijderd_op" IS NULL) = ("verwijderd_door" IS NULL))
);
CREATE INDEX "kandidaat_opmerking_kandidaat_id_tijdstip_idx" ON "kandidaat_opmerking"("kandidaat_id", "tijdstip");

-- Bijna append-only: de enige wijziging is één keer logisch verwijderen; de tekst en de
-- auteur liggen vast. DELETE alleen via verwijder_werkkopie() (ADR-0006), die de
-- kandidaten verwijdert en zo deze rijen via de foreign key meeneemt.
CREATE OR REPLACE FUNCTION kandidaat_opmerking_bescherming()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."taakinstantie_id"::text = current_setting('cockpit.werkkopie_verwijderen', true) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Opmerkingen worden alleen logisch verwijderd';
  END IF;

  IF OLD."verwijderd_op" IS NOT NULL
     OR NEW."verwijderd_op" IS NULL
     OR (NEW."id", NEW."kandidaat_id", NEW."taakinstantie_id", NEW."ronde", NEW."rol", NEW."tekst", NEW."medewerker_id", NEW."tijdstip")
        IS DISTINCT FROM
        (OLD."id", OLD."kandidaat_id", OLD."taakinstantie_id", OLD."ronde", OLD."rol", OLD."tekst", OLD."medewerker_id", OLD."tijdstip") THEN
    RAISE EXCEPTION 'Een opmerking kan alleen één keer logisch worden verwijderd';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "kandidaat_opmerking_bescherming"
BEFORE UPDATE OR DELETE ON "kandidaat_opmerking"
FOR EACH ROW EXECUTE FUNCTION kandidaat_opmerking_bescherming();

CREATE TRIGGER "kandidaat_opmerking_geen_truncate"
BEFORE TRUNCATE ON "kandidaat_opmerking"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_change();

DO $$
BEGIN
  EXECUTE format('REVOKE DELETE, TRUNCATE ON "kandidaat_opmerking" FROM %I', current_database() || '_app');
END $$;
