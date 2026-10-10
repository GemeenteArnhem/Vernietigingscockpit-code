-- Eventtypen volgens MDTO (ADR-0005 §5, wijzigt ADR-0003 §1): `actie` wordt `event_type`
-- (begripLabel) met `event_type_begrippenlijst`. De hash dekt de nieuwe kolommen; bestaande
-- events kunnen niet worden herschreven zonder de keten te breken, dus de tabellen moeten leeg
-- zijn (besluit 2026-10-08: lege database).
DO $$
DECLARE
  audit bigint;
  configuratie bigint;
BEGIN
  SELECT count(*) INTO audit FROM "audit_event";
  SELECT count(*) INTO configuratie FROM "configuratie_event";
  IF audit > 0 OR configuratie > 0 THEN
    RAISE EXCEPTION 'audit_event (% rijen) of configuratie_event (% rijen) is niet leeg. ADR-0005 vereist een lege database voor de MDTO-eventtypen: bouw de database opnieuw op en draai daarna de migraties.',
      audit, configuratie;
  END IF;
END $$;

ALTER TABLE "audit_event" RENAME COLUMN "actie" TO "event_type";
ALTER TABLE "audit_event" ADD COLUMN "event_type_begrippenlijst" TEXT NOT NULL;
ALTER TABLE "configuratie_event" RENAME COLUMN "actie" TO "event_type";
ALTER TABLE "configuratie_event" ADD COLUMN "event_type_begrippenlijst" TEXT NOT NULL;
