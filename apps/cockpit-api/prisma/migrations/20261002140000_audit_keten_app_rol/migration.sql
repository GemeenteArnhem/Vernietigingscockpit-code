-- ADR-0003: auditketen per taakinstantie en databasebescherming van de auditlogs.

-- 1. De nieuwe hashwijze is niet verenigbaar met bestaande events. Afgesproken is te
--    beginnen met een lege database; bestaande events worden niet aangepast of gewist.
DO $$
DECLARE
  aantal_audit bigint;
  aantal_configuratie bigint;
BEGIN
  SELECT count(*) INTO aantal_audit FROM "audit_event";
  SELECT count(*) INTO aantal_configuratie FROM "configuratie_event";

  IF aantal_audit > 0 OR aantal_configuratie > 0 THEN
    RAISE EXCEPTION 'audit_event (% rijen) of configuratie_event (% rijen) is niet leeg. ADR-0003 vereist een lege database voor de nieuwe auditketen: bouw de database opnieuw op en draai daarna de migraties.',
      aantal_audit, aantal_configuratie;
  END IF;
END $$;

-- 2. Keten per taak: lezen van de vorige hash en verificatie gaan op (taakinstantie_id, id).
CREATE INDEX "idx_audit_event_taak" ON "audit_event"("taakinstantie_id", "id");

-- 3. Ook TRUNCATE weigeren, voor iedereen (de rij-triggers vangen TRUNCATE niet).
CREATE TRIGGER "audit_event_geen_truncate"
BEFORE TRUNCATE ON "audit_event"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_change();

CREATE TRIGGER "configuratie_event_geen_truncate"
BEFORE TRUNCATE ON "configuratie_event"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_immutable_change();

-- 4. Applicatierol '<database>_app' (NOLOGIN). De API verbindt met een loginrol die lid is
--    van deze rol (scripts/db-app-gebruiker.mjs); migraties blijven als eigenaar draaien.
--    De naam bevat de database, zodat omgevingen op één cluster elkaars tabellen niet krijgen.
--    Op de auditlogs alleen SELECT en INSERT.
DO $$
DECLARE
  app_rol text := current_database() || '_app';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_rol) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', app_rol);
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_rol);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_rol);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_rol);
  EXECUTE format('REVOKE ALL ON "_prisma_migrations" FROM %I', app_rol);
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON "audit_event", "configuratie_event" FROM %I', app_rol);

  -- Tabellen uit latere migraties krijgen automatisch dezelfde rechten.
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_rol);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', app_rol);
END $$;
