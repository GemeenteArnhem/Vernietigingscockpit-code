-- ADR-0006: verwijderen van de werkkopie van een vernietigingsdossier na archivering.
-- - instelling: de bewaartermijn van de werkkopie (ISO 8601-duur), per organisatie instelbaar;
-- - dossier_grafsteen: insert-only, eigen hashketen; blijft na het verwijderen bestaan;
-- - verwijder_werkkopie(): de enige weg om de rijen van één taak te verwijderen. De functie
--   controleert de voorwaarden zelf (ADR-0006 §2 en §4) en zet een transactievariabele die
--   de append-only-triggers op audit_event en kandidaat_besluit alleen voor die taak openzet.

-- 1. Instellingen (sleutel/waarde). De applicatie schrijft elke wijziging ook als
--    configuratie-event 'Instelling gewijzigd'.
CREATE TABLE "instelling" (
  "sleutel"       TEXT PRIMARY KEY,
  "waarde"        TEXT NOT NULL,
  "gewijzigd_op"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "gewijzigd_door" TEXT
);

ALTER TABLE "instelling" ADD CONSTRAINT "instelling_werkkopie_bewaartermijn_iso"
  CHECK ("sleutel" <> 'werkkopie_bewaartermijn'
         OR "waarde" ~ '^P(?!$)([0-9]+Y)?([0-9]+M)?([0-9]+W)?([0-9]+D)?(T(?=[0-9])([0-9]+H)?([0-9]+M)?([0-9]+S)?)?$');

-- 2. Grafsteen per verwijderde werkkopie. Geen persoonsgegevens, geen kandidaatgegevens en
--    geen taaknaam. Bewust geen foreign key naar taakinstantie: die rij verdwijnt.
CREATE TABLE "dossier_grafsteen" (
  "id"                     BIGSERIAL PRIMARY KEY,
  "taakinstantie_id"       UUID NOT NULL UNIQUE,
  "taakdefinitie_id"       UUID NOT NULL,
  "archiefvormer"          JSONB NOT NULL,
  "archivering_id"         UUID NOT NULL,
  "archief_adapter"        TEXT NOT NULL,
  "archief_locatie"        TEXT NOT NULL,
  "openzaak_zaak_id"       TEXT,
  "dossier_sha256"         TEXT NOT NULL,
  "verificatie"            JSONB NOT NULL,
  "audit_aantal_events"    INTEGER NOT NULL,
  "audit_laatste_hash"     TEXT NOT NULL,
  "lijst_hash"             TEXT,
  "verklaring_pdf_sha256"  TEXT,
  "verklaring_versie"      INTEGER,
  "afgerond_op"            TIMESTAMPTZ,
  "gearchiveerd_op"        TIMESTAMPTZ NOT NULL,
  "verwijderd_op"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "bewaartermijn_werkkopie" TEXT NOT NULL,
  "vorige_hash"            TEXT,
  "hash"                   TEXT NOT NULL
);

CREATE TRIGGER "dossier_grafsteen_append_only"
BEFORE UPDATE OR DELETE ON "dossier_grafsteen"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_change();

CREATE TRIGGER "dossier_grafsteen_geen_truncate"
BEFORE TRUNCATE ON "dossier_grafsteen"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_change();

-- 3. Append-only met één uitzondering: DELETE van de rijen van de taak waarvoor
--    verwijder_werkkopie() de transactievariabele heeft gezet. UPDATE blijft geweigerd;
--    TRUNCATE blijft geweigerd via de bestaande statement-triggers.
CREATE OR REPLACE FUNCTION werkkopie_append_only()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND OLD."taakinstantie_id"::text = current_setting('cockpit.werkkopie_verwijderen', true) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Tabel % is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "audit_event_append_only" ON "audit_event";
CREATE TRIGGER "audit_event_append_only"
BEFORE UPDATE OR DELETE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION werkkopie_append_only();

DROP TRIGGER "kandidaat_besluit_append_only" ON "kandidaat_besluit";
CREATE TRIGGER "kandidaat_besluit_append_only"
BEFORE UPDATE OR DELETE ON "kandidaat_besluit"
FOR EACH ROW EXECUTE FUNCTION werkkopie_append_only();

-- 4. De verwijderfunctie. SECURITY DEFINER: draait als de eigenaar van de tabellen (de
--    migratierol); de app-rol mag hem alleen uitvoeren. De applicatie heeft vooraf in
--    dezelfde transactie de grafsteen en het configuratie-event geschreven (hun hashketens
--    worden in de applicatie berekend, zoals bij alle ketens) en het pakket geverifieerd;
--    de functie controleert dat alles klopt en verwijdert pas dan.
CREATE OR REPLACE FUNCTION verwijder_werkkopie(p_taakinstantie_id UUID, p_grafsteen_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  taak RECORD;
  steen RECORD;
  arch RECORD;
  keten RECORD;
  termijn TEXT;
BEGIN
  SELECT * INTO taak FROM "taakinstantie" WHERE "id" = p_taakinstantie_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'verwijder_werkkopie: taak % bestaat niet.', p_taakinstantie_id;
  END IF;

  -- Voorwaarde 1: status archief.
  IF taak."status" <> 'archief' THEN
    RAISE EXCEPTION 'verwijder_werkkopie: taak % heeft status %, niet archief.', p_taakinstantie_id, taak."status";
  END IF;

  -- De grafsteen hoort bij deze taak en is in deze transactie geschreven.
  SELECT * INTO steen FROM "dossier_grafsteen" WHERE "id" = p_grafsteen_id;
  IF NOT FOUND OR steen."taakinstantie_id" <> p_taakinstantie_id THEN
    RAISE EXCEPTION 'verwijder_werkkopie: geen grafsteen % voor taak %.', p_grafsteen_id, p_taakinstantie_id;
  END IF;
  -- verwijderd_op is now() van deze transactie, op milliseconden (zoals de applicatie hem hasht).
  IF steen."verwijderd_op" <> date_trunc('milliseconds', now()) THEN
    RAISE EXCEPTION 'verwijder_werkkopie: grafsteen % is niet in deze transactie geschreven.', p_grafsteen_id;
  END IF;

  -- Voorwaarde 3: het pakket is zojuist geverifieerd.
  IF steen."verificatie" ->> 'uitkomst' IS DISTINCT FROM 'geslaagd' THEN
    RAISE EXCEPTION 'verwijder_werkkopie: geen geslaagde verificatie van het archiefpakket voor taak %.', p_taakinstantie_id;
  END IF;

  -- Voorwaarde 2: geslaagde archivering, dezelfde als in de grafsteen.
  SELECT * INTO arch FROM "archivering"
  WHERE "id" = steen."archivering_id" AND "taakinstantie_id" = p_taakinstantie_id AND "status" = 'SUCCESS';
  IF NOT FOUND OR arch."dossier_sha256" IS DISTINCT FROM steen."dossier_sha256" THEN
    RAISE EXCEPTION 'verwijder_werkkopie: geen geslaagde archivering % met deze dossier-hash voor taak %.', steen."archivering_id", p_taakinstantie_id;
  END IF;

  -- Voorwaarde 4: termijn verstreken, gerekend met de klok van de database.
  SELECT "waarde" INTO termijn FROM "instelling" WHERE "sleutel" = 'werkkopie_bewaartermijn';
  IF termijn IS NULL OR termijn <> steen."bewaartermijn_werkkopie" THEN
    RAISE EXCEPTION 'verwijder_werkkopie: de bewaartermijn in de grafsteen (%) is niet de ingestelde (%).', steen."bewaartermijn_werkkopie", termijn;
  END IF;
  IF arch."afgerond_op" IS NULL OR arch."afgerond_op" + termijn::interval > now() THEN
    RAISE EXCEPTION 'verwijder_werkkopie: de bewaartermijn % van de werkkopie van taak % is nog niet verstreken.', termijn, p_taakinstantie_id;
  END IF;

  -- Voorwaarde 5: de auditketen is aaneengesloten en eindigt bij de hash in de grafsteen.
  -- (De hashes zelf herberekent de applicatie vooraf; hier: schakels, aantal en sluitstuk.)
  SELECT count(*) AS aantal,
         count(*) FILTER (WHERE k."vorige_hash" IS DISTINCT FROM k."vorig") AS breuken,
         (array_agg(k."hash" ORDER BY k."id" DESC))[1] AS laatste
    INTO keten
    FROM (
      SELECT "id", "hash", "vorige_hash", lag("hash") OVER (ORDER BY "id") AS "vorig"
      FROM "audit_event" WHERE "taakinstantie_id" = p_taakinstantie_id
    ) k;
  IF keten.breuken > 0 OR keten.aantal <> steen."audit_aantal_events" OR keten.laatste IS DISTINCT FROM steen."audit_laatste_hash" THEN
    RAISE EXCEPTION 'verwijder_werkkopie: de auditketen van taak % is niet intact of komt niet overeen met de grafsteen.', p_taakinstantie_id;
  END IF;

  -- Het configuratie-event 'Werkkopie verwijderd' met deze grafsteen is geschreven.
  IF NOT EXISTS (
    SELECT 1 FROM "configuratie_event"
    WHERE "event_type" = 'Werkkopie verwijderd'
      AND "entiteit_id" = p_taakinstantie_id::text
      AND "details" ->> 'grafsteenId' = p_grafsteen_id::text
  ) THEN
    RAISE EXCEPTION 'verwijder_werkkopie: het configuratie-event Werkkopie verwijderd voor taak % ontbreekt.', p_taakinstantie_id;
  END IF;

  -- Verwijderen, in FK-volgorde.
  PERFORM set_config('cockpit.werkkopie_verwijderen', p_taakinstantie_id::text, true);

  DELETE FROM "uitvoeringsresultaat"
  WHERE "vernietiging_id" IN (SELECT "id" FROM "vernietiging" WHERE "taakinstantie_id" = p_taakinstantie_id);
  DELETE FROM "vernietiging_batch"
  WHERE "vernietiging_id" IN (SELECT "id" FROM "vernietiging" WHERE "taakinstantie_id" = p_taakinstantie_id);
  DELETE FROM "vernietiging" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "kandidaat_besluit" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "vernietigingskandidaat"
  WHERE "selectie_id" IN (SELECT "id" FROM "selectie" WHERE "taakinstantie_id" = p_taakinstantie_id);
  DELETE FROM "selectie" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "verklaring" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "archivering" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "outbox" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "audit_event" WHERE "taakinstantie_id" = p_taakinstantie_id;
  DELETE FROM "taakinstantie" WHERE "id" = p_taakinstantie_id;

  PERFORM set_config('cockpit.werkkopie_verwijderen', '', true);
END;
$$;

-- 5. Rechten: de app-rol leest en voegt toe op de grafsteen, en mag de functie uitvoeren.
DO $$
DECLARE
  app_rol text := current_database() || '_app';
BEGIN
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON "dossier_grafsteen" FROM %I', app_rol);
  EXECUTE 'REVOKE ALL ON FUNCTION verwijder_werkkopie(UUID, BIGINT) FROM PUBLIC';
  EXECUTE format('GRANT EXECUTE ON FUNCTION verwijder_werkkopie(UUID, BIGINT) TO %I', app_rol);
END $$;
