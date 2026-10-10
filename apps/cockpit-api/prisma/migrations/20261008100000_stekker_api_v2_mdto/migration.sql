-- Stekker API v2 en MDTO (ADR-0005), stap 1: vernietigingskandidaten krijgen de MDTO-gegevens
-- uit de stekker; uitvoeringsresultaten het event Vernietigen en de specificatie; een
-- vernietiging de vernietigingsmethode. Oude v1-velden worden niet omgezet (besluit
-- 2026-10-08: lege database), dus de migratie stopt als er al taakuitvoeringen zijn.
DO $$
DECLARE
  aantal bigint;
BEGIN
  SELECT count(*) INTO aantal FROM "taakinstantie";
  IF aantal > 0 THEN
    RAISE EXCEPTION 'Er zijn % taakuitvoering(en). ADR-0005 (Stekker API v2, MDTO) zet bestaande kandidaten niet om: bouw de database opnieuw op en draai daarna de migraties.', aantal;
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "idx_vernietigingskandidaat_vernietigingsdatum";
-- DropIndex
DROP INDEX IF EXISTS "idx_vernietigingskandidaat_grondslag";
-- AlterTable
ALTER TABLE "vernietigingskandidaat" DROP COLUMN "begindatum",
DROP COLUMN "bewaartermijn",
DROP COLUMN "bron",
DROP COLUMN "bron_id",
DROP COLUMN "bron_id_naam",
DROP COLUMN "classificatieomschrijving",
DROP COLUMN "classificatieschema",
DROP COLUMN "classificatiesleutel",
DROP COLUMN "einddatum",
DROP COLUMN "grondslag",
DROP COLUMN "grondslag_afwijkend",
DROP COLUMN "relatie_id",
DROP COLUMN "relatie_type",
DROP COLUMN "resultaat",
DROP COLUMN "vernietigingsdatum",
DROP COLUMN "waardering",
ADD COLUMN     "activiteit" JSONB,
ADD COLUMN     "aggregatieniveau" TEXT NOT NULL,
ADD COLUMN     "archiefvormer" JSONB,
ADD COLUMN     "classificatie" JSONB,
ADD COLUMN     "classificatie_begrip_code" TEXT,
ADD COLUMN     "classificatie_begrip_label" TEXT,
ADD COLUMN     "classificatie_begrippenlijst" TEXT,
ADD COLUMN     "dekking_in_tijd" JSONB,
ADD COLUMN     "dekking_in_tijd_begindatum" TEXT,
ADD COLUMN     "dekking_in_tijd_einddatum" TEXT,
ADD COLUMN     "gerelateerd_informatieobject" JSONB,
ADD COLUMN     "identificatie" JSONB NOT NULL,
ADD COLUMN     "identificatie_kenmerken" TEXT NOT NULL,
ADD COLUMN     "informatiecategorie_afwijking" JSONB,
ADD COLUMN     "informatiecategorie_begrip_code" TEXT,
ADD COLUMN     "informatiecategorie_begrip_label" TEXT NOT NULL,
ADD COLUMN     "informatiecategorie_begrippenlijst" JSONB NOT NULL,
ADD COLUMN     "is_onderdeel_van" JSONB,
ADD COLUMN     "naam" TEXT NOT NULL,
ADD COLUMN     "stekker_toelichting" TEXT,
ADD COLUMN     "termijn_einddatum" DATE NOT NULL,
ADD COLUMN     "termijn_looptijd" TEXT,
ADD COLUMN     "termijn_startdatum_looptijd" DATE,
ADD COLUMN     "termijn_trigger_start_looptijd" JSONB,
ADD COLUMN     "waardering_begrip_code" TEXT NOT NULL,
ADD COLUMN     "waardering_begrip_label" TEXT NOT NULL,
DROP COLUMN "omschrijving",
ADD COLUMN     "omschrijving" JSONB,
ALTER COLUMN "selectielijst" SET NOT NULL;
-- AlterTable
ALTER TABLE "vernietiging" ADD COLUMN     "vernietigingsmethode" JSONB,
ADD COLUMN     "vernietigingsmethode_toelichting" TEXT;
-- AlterTable
ALTER TABLE "uitvoeringsresultaat" ADD COLUMN     "bron_event_referentie" TEXT,
ADD COLUMN     "event" JSONB,
ADD COLUMN     "event_tijd" TIMESTAMPTZ,
ADD COLUMN     "identificatie" JSONB,
ADD COLUMN     "specificatie" BYTEA,
ADD COLUMN     "specificatie_sha256" TEXT,
ADD COLUMN     "toelichting" TEXT;
-- CreateIndex
CREATE INDEX "idx_vernietigingskandidaat_termijn_einddatum" ON "vernietigingskandidaat"("termijn_einddatum");
-- CreateIndex
CREATE INDEX "idx_vernietigingskandidaat_informatiecategorie" ON "vernietigingskandidaat"("informatiecategorie_begrip_label");
