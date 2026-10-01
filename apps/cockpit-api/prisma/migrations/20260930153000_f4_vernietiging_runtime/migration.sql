ALTER TABLE "selectie"
  ADD COLUMN "extern_vernietiging_id" TEXT,
  ADD COLUMN "vernietiging_status" TEXT,
  ADD COLUMN "vernietiging_gestart_op" TIMESTAMP(3),
  ADD COLUMN "vernietiging_afgerond_op" TIMESTAMP(3),
  ADD COLUMN "vernietiging_resultaat" JSONB;
