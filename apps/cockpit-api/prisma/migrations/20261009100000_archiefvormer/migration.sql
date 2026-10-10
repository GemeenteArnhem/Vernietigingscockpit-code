-- Archiefvormer (ADR-0005, B-M3, besluit 2026-10-09): op het profiel van de proceseigenaar
-- (medewerker, via de stamgegevens-import) en vastgepind op elke taakuitvoering.
ALTER TABLE "medewerker" ADD COLUMN "archiefvormer" JSONB;
ALTER TABLE "taakinstantie" ADD COLUMN "archiefvormer" JSONB;
