-- CC-16: selectie robuuster.
-- * Herkansen maakt een nieuw selectierecord; het oude blijft voor het dossier met status
--   VERVANGEN en een verwijzing naar het nieuwe.
-- * Fouten bij het opvragen van de status: opnieuw met backoff (poll_fouten, volgende_poll_op).

ALTER TABLE "selectie"
  -- Uitgesteld gecontroleerd: bij herkansen wordt eerst de oude als VERVANGEN gemarkeerd
  -- (met het id van de nieuwe) en daarna de nieuwe aangemaakt, in één transactie.
  ADD COLUMN "vervangen_door_id" uuid REFERENCES "selectie"("id") DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN "poll_fouten" integer NOT NULL DEFAULT 0,
  ADD COLUMN "volgende_poll_op" timestamptz;

ALTER TABLE "selectie"
  ADD CONSTRAINT "selectie_status_geldig"
  CHECK ("status" IN ('AANGEVRAAGD', 'RUNNING', 'READY', 'GEIMPORTEERD', 'FAILED', 'VERVANGEN'));

ALTER TABLE "selectie"
  ADD CONSTRAINT "selectie_vervangen_met_verwijzing"
  CHECK (("status" = 'VERVANGEN') = ("vervangen_door_id" IS NOT NULL));

-- Per taak en stekker hooguit één actieve selectie.
CREATE UNIQUE INDEX "selectie_een_actieve_per_stekker"
  ON "selectie"("taakinstantie_id", "stekker_id")
  WHERE "status" <> 'VERVANGEN';
