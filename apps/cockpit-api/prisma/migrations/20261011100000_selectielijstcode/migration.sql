-- Selectielijstcode (ADR-0008): elke kandidaat krijgt de code van de selectielijst uit het
-- register Cockpit-selectielijsten, en of die code bij import in het register stond. Bestaande
-- kandidaten hebben geen geldige code (besluit 2026-10-11: lege database), dus de migratie stopt
-- als er al kandidaten zijn.
DO $$
DECLARE
  aantal bigint;
BEGIN
  SELECT count(*) INTO aantal FROM "vernietigingskandidaat";
  IF aantal > 0 THEN
    RAISE EXCEPTION 'Er zijn % vernietigingskandidaat/-kandidaten. ADR-0008 (selectielijstcode) zet bestaande kandidaten niet om: bouw de database opnieuw op en draai daarna de migraties.', aantal;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "vernietigingskandidaat" ADD COLUMN "selectielijst_code" TEXT NOT NULL,
ADD COLUMN "selectielijst_bekend" BOOLEAN NOT NULL;
