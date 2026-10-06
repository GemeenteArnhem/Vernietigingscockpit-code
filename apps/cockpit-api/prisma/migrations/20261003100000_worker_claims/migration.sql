-- CC-7 / B-A: meerdere workers naast elkaar. Een worker claimt een job of selectie met
-- FOR UPDATE SKIP LOCKED en een lease; na de lease mag een andere worker het overnemen.

ALTER TABLE "outbox"
  ADD COLUMN "geclaimd_tot" timestamptz,
  ADD COLUMN "geclaimd_door" text;

ALTER TABLE "selectie"
  ADD COLUMN "geclaimd_tot" timestamptz,
  ADD COLUMN "geclaimd_door" text;
