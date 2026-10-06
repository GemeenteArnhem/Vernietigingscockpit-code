-- Retrybeleid voor stekker-jobs (actielijst CC-2):
-- - status OPEN / VERWERKT / MISLUKT in plaats van alleen verzonden_op;
-- - pogingen en volgende_poging_op voor exponentiële backoff bij tijdelijke fouten;
-- - laatste_fout voor de foutmelding van de laatste poging.

ALTER TABLE "outbox"
  ADD COLUMN "status" text NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "pogingen" integer NOT NULL DEFAULT 0,
  ADD COLUMN "volgende_poging_op" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN "laatste_fout" text;

-- Bestaande jobs: afgehandeld = verwerkt.
UPDATE "outbox" SET "status" = 'VERWERKT' WHERE "verzonden_op" IS NOT NULL;

ALTER TABLE "outbox"
  ADD CONSTRAINT "outbox_status" CHECK ("status" IN ('OPEN', 'VERWERKT', 'MISLUKT')),
  ADD CONSTRAINT "outbox_pogingen" CHECK ("pogingen" >= 0);

DROP INDEX IF EXISTS "idx_outbox_open";
CREATE INDEX "idx_outbox_open" ON "outbox" ("queue", "job_naam", "volgende_poging_op") WHERE "status" = 'OPEN';
