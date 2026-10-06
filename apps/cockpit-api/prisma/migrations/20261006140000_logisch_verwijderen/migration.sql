-- Verwijderen van taken en taakuitvoeringen door de functioneel beheerder. Het auditlog is
-- append-only (ADR-0003): een taakuitvoering met audit-events wordt daarom logisch verwijderd
-- (verwijderd_op), niet echt. Het verwijderen zelf staat in het log (TASK_DELETED,
-- TASK_DEFINITION_DELETED). Een taakdefinitie zonder uitvoeringen kan wel echt weg.
ALTER TABLE "taakdefinitie" ADD COLUMN "verwijderd_op" TIMESTAMPTZ, ADD COLUMN "verwijderd_door" TEXT;
ALTER TABLE "taakinstantie" ADD COLUMN "verwijderd_op" TIMESTAMPTZ, ADD COLUMN "verwijderd_door" TEXT;

-- Een verwijderde geplande uitvoering telt niet mee voor 'één geplande per definitie'.
DROP INDEX "taakinstantie_een_geplande_per_definitie";
CREATE UNIQUE INDEX "taakinstantie_een_geplande_per_definitie"
  ON "taakinstantie" ("taakdefinitie_id")
  WHERE "status" = 'init' AND "gepland_op" IS NOT NULL AND "verwijderd_op" IS NULL;
