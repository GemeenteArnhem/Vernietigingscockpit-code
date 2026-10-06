-- CC-18: archivering van het vernietigingsdossier (architectuur §7.2.7). Per poging een
-- regel; de overgang resultaat -> archief volgt pas als het archiveren is gelukt.
CREATE TABLE "archivering" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taakinstantie_id" uuid NOT NULL REFERENCES "taakinstantie"("id"),
  "status" text NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'SUCCESS', 'FAILED')),
  "adapter" text NOT NULL,
  "verklaring_versie" integer,
  "locatie" text,
  "manifest_sha256" text,
  "openzaak_zaak_id" text,
  "fout" text,
  "aangevraagd_door" text NOT NULL,
  "aangevraagd_op" timestamptz NOT NULL DEFAULT now(),
  "afgerond_op" timestamptz
);
CREATE INDEX "archivering_taakinstantie_id_idx" ON "archivering"("taakinstantie_id");

-- Hooguit één lopende archivering per taak.
CREATE UNIQUE INDEX "archivering_een_lopende_per_taak" ON "archivering"("taakinstantie_id") WHERE "status" = 'PENDING';
