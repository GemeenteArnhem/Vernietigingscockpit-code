-- CC-9: besluiten van PO en archivaris per kandidaat apart en append-only vastleggen, zodat
-- de toelichting van de recordmanager niet meer wordt overschreven. Plus de vingerafdruk
-- van de lijst bij de vrijgave door de archivaris.

ALTER TABLE "vernietigingskandidaat" ADD COLUMN "beoordeeld_op" timestamptz;
ALTER TABLE "taakinstantie" ADD COLUMN "lijst_hash" text;

CREATE TABLE "kandidaat_besluit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kandidaat_id" uuid NOT NULL REFERENCES "vernietigingskandidaat"("id"),
  "taakinstantie_id" uuid NOT NULL REFERENCES "taakinstantie"("id"),
  "ronde" integer NOT NULL CHECK ("ronde" > 0),
  "rol" text NOT NULL CHECK ("rol" IN ('proceseigenaar', 'archivaris')),
  "besluit" text NOT NULL CHECK ("besluit" IN ('AKKOORD', 'RETOUR')),
  "toelichting" text,
  "medewerker_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "tijdstip" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "kandidaat_besluit_kandidaat_id_tijdstip_idx" ON "kandidaat_besluit"("kandidaat_id", "tijdstip");

-- Append-only, net als de auditlogs.
CREATE TRIGGER "kandidaat_besluit_append_only"
BEFORE UPDATE OR DELETE ON "kandidaat_besluit"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_change();

CREATE TRIGGER "kandidaat_besluit_geen_truncate"
BEFORE TRUNCATE ON "kandidaat_besluit"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_change();

DO $$
BEGIN
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON "kandidaat_besluit" FROM %I', current_database() || '_app');
END $$;
