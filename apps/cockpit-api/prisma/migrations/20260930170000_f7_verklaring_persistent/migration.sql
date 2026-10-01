CREATE TABLE "verklaring" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "taakinstantie_id" UUID NOT NULL,
  "versie" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "pdf" BYTEA NOT NULL,
  "pdf_sha256" TEXT NOT NULL,
  "csv" BYTEA NOT NULL,
  "csv_sha256" TEXT NOT NULL,
  "csv_bestandsnaam" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "gegenereerd_op" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "gegenereerd_door" TEXT,

  CONSTRAINT "verklaring_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verklaring_taakinstantie_id_versie_key"
  ON "verklaring"("taakinstantie_id", "versie");

CREATE INDEX "verklaring_taakinstantie_id_gegenereerd_op_idx"
  ON "verklaring"("taakinstantie_id", "gegenereerd_op");

ALTER TABLE "verklaring"
  ADD CONSTRAINT "verklaring_taakinstantie_id_fkey"
  FOREIGN KEY ("taakinstantie_id") REFERENCES "taakinstantie"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
