CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "AppRole" AS ENUM (
  'recordmanager',
  'proceseigenaar',
  'archivaris',
  'functioneel_beheerder',
  'auditor'
);

CREATE TYPE "Frequentie" AS ENUM (
  'jaarlijks',
  'kwartaal',
  'maandelijks',
  'ad_hoc'
);

CREATE TYPE "TaakStatus" AS ENUM (
  'init',
  'beoordeling',
  'accordering_po',
  'accordering_archivaris',
  'vrijgegeven',
  'uitvoering',
  'resultaat',
  'archief'
);

CREATE TYPE "AuditActorType" AS ENUM ('user', 'system');

CREATE TABLE "afdeling" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "naam" text NOT NULL,
  "code" text NOT NULL UNIQUE,
  "actief" boolean NOT NULL DEFAULT true
);

CREATE TABLE "medewerker" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "naam" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "rollen" "AppRole"[] NOT NULL,
  "afdeling_id" uuid REFERENCES "afdeling"("id"),
  "actief" boolean NOT NULL DEFAULT true,
  "bron" text NOT NULL,
  "extern_id" text
);

CREATE TABLE "gebruiker" (
  "id" text PRIMARY KEY,
  "medewerker_id" uuid UNIQUE REFERENCES "medewerker"("id"),
  "naam" text NOT NULL,
  "email" text,
  "rollen" "AppRole"[] NOT NULL,
  "laatst_gezien" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "stekker" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "naam" text NOT NULL,
  "omschrijving" text,
  "actief" boolean NOT NULL DEFAULT true
);

CREATE TABLE "stekker_configuratie" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "stekker_id" uuid NOT NULL REFERENCES "stekker"("id"),
  "versie" integer NOT NULL,
  "base_url" text NOT NULL,
  "auth_type" text NOT NULL,
  "token_url" text,
  "client_id" text,
  "secret_ref" text,
  "scopes" text[] NOT NULL,
  "parameters" jsonb NOT NULL,
  "verwachte_api_major" integer NOT NULL,
  "timeouts" jsonb NOT NULL,
  "aangemaakt_door" text NOT NULL,
  "aangemaakt_op" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("stekker_id", "versie")
);

CREATE TABLE "taakdefinitie" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "naam" text NOT NULL,
  "omschrijving" text,
  "categorie" text NOT NULL,
  "frequentie" "Frequentie" NOT NULL,
  "startmaand" integer,
  "recordmanager_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "proceseigenaar_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "archivaris_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "actief" boolean NOT NULL DEFAULT true,
  "versie" integer NOT NULL DEFAULT 1,
  CONSTRAINT "taakdefinitie_functiescheiding" CHECK (
    "recordmanager_id" <> "archivaris_id"
    AND "proceseigenaar_id" <> "archivaris_id"
  )
);

CREATE TABLE "taakdefinitie_stekker" (
  "taakdefinitie_id" uuid NOT NULL REFERENCES "taakdefinitie"("id"),
  "stekker_id" uuid NOT NULL REFERENCES "stekker"("id"),
  "selectieparameters" jsonb NOT NULL,
  PRIMARY KEY ("taakdefinitie_id", "stekker_id")
);

CREATE TABLE "taakinstantie" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taakdefinitie_id" uuid NOT NULL REFERENCES "taakdefinitie"("id"),
  "naam" text NOT NULL,
  "status" "TaakStatus" NOT NULL,
  "stap_sinds" timestamptz NOT NULL DEFAULT now(),
  "ronde" integer NOT NULL DEFAULT 1,
  "peildatum" date,
  "recordmanager_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "proceseigenaar_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "archivaris_id" uuid NOT NULL REFERENCES "medewerker"("id"),
  "gestart_op" timestamptz,
  "afgerond_op" timestamptz,
  "versie" integer NOT NULL DEFAULT 1
);

CREATE TABLE "selectie" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taakinstantie_id" uuid NOT NULL REFERENCES "taakinstantie"("id"),
  "stekker_id" uuid NOT NULL REFERENCES "stekker"("id"),
  "stekker_configuratie_id" uuid NOT NULL REFERENCES "stekker_configuratie"("id"),
  "extern_selectie_id" text,
  "status" text NOT NULL,
  "peildatum" date,
  "selectietijdstip" timestamptz,
  "totaal_kandidaten" integer NOT NULL DEFAULT 0,
  "totaal_objecten" integer NOT NULL DEFAULT 0,
  "totaal_betrokkenen" integer NOT NULL DEFAULT 0,
  "stekkerversie" text,
  "configuratieversie" text,
  "api_versie" text,
  "geimporteerd" integer NOT NULL DEFAULT 0,
  "fout" text
);

CREATE TABLE "audit_event" (
  "id" bigserial PRIMARY KEY,
  "taakinstantie_id" uuid NOT NULL REFERENCES "taakinstantie"("id"),
  "tijdstip" timestamptz NOT NULL DEFAULT now(),
  "actor_type" "AuditActorType" NOT NULL,
  "actor_id" text,
  "actor_naam" text,
  "rol" "AppRole",
  "actie" text NOT NULL,
  "entiteit_type" text NOT NULL,
  "entiteit_id" text NOT NULL,
  "details" jsonb NOT NULL,
  "correlatie_id" text,
  "vorige_hash" text,
  "hash" text NOT NULL
);

CREATE TABLE "configuratie_event" (
  "id" bigserial PRIMARY KEY,
  "tijdstip" timestamptz NOT NULL DEFAULT now(),
  "actor_type" "AuditActorType" NOT NULL,
  "actor_id" text,
  "actor_naam" text,
  "rol" "AppRole",
  "actie" text NOT NULL,
  "entiteit_type" text NOT NULL,
  "entiteit_id" text NOT NULL,
  "details" jsonb NOT NULL,
  "correlatie_id" text,
  "vorige_hash" text,
  "hash" text NOT NULL
);

CREATE TABLE "outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "taakinstantie_id" uuid REFERENCES "taakinstantie"("id"),
  "queue" text NOT NULL,
  "job_naam" text NOT NULL,
  "payload" jsonb NOT NULL,
  "aangemaakt_op" timestamptz NOT NULL DEFAULT now(),
  "verzonden_op" timestamptz
);

CREATE INDEX "idx_medewerker_afdeling" ON "medewerker"("afdeling_id");
CREATE INDEX "idx_taakdefinitie_actief" ON "taakdefinitie"("actief");
CREATE INDEX "idx_taakinstantie_status" ON "taakinstantie"("status");
CREATE INDEX "idx_selectie_taakinstantie" ON "selectie"("taakinstantie_id");
CREATE INDEX "idx_outbox_open" ON "outbox"("queue", "aangemaakt_op") WHERE "verzonden_op" IS NULL;

CREATE OR REPLACE FUNCTION prevent_immutable_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_event_append_only"
BEFORE UPDATE OR DELETE ON "audit_event"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_change();

CREATE TRIGGER "configuratie_event_append_only"
BEFORE UPDATE OR DELETE ON "configuratie_event"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_change();
