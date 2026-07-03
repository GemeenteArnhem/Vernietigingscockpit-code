CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS taken (
  id text PRIMARY KEY,
  naam text NOT NULL,
  omschrijving text,
  frequentie text NOT NULL,
  eigenaar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS taakuitvoeringen (
  id text PRIMARY KEY,
  taak_id text NOT NULL REFERENCES taken(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN (
      'concept',
      'selectie_bezig',
      'review',
      'wacht_op_proceseigenaar',
      'wacht_op_archivaris',
      'goedgekeurd',
      'vernietiging_bezig',
      'afgerond',
      'gearchiveerd'
    )
  ),
  huidige_stap text NOT NULL,
  gestart_op timestamptz,
  afgerond_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taakuitvoering_id text NOT NULL UNIQUE REFERENCES taakuitvoeringen(id) ON DELETE CASCADE,
  naam text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vernietigingsobjecten (
  id text PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  titel text NOT NULL,
  omvang integer NOT NULL CHECK (omvang >= 0),
  bewaartermijn integer NOT NULL CHECK (bewaartermijn >= 0),
  vernietigingsdatum text NOT NULL,
  review_status text CHECK (review_status IN ('OK', 'FOUT', 'OVERGESLAGEN', 'NIET_GEVONDEN')),
  beoordeeld boolean NOT NULL DEFAULT false,
  uitgesloten boolean NOT NULL DEFAULT false,
  reden text,
  toelichting text,
  proceseigenaar_toelichting text,
  archivaris_toelichting text,
  bron_id text,
  code text,
  startdatum text,
  einddatum text,
  selectielijst text,
  resultaat text,
  grondslag text,
  bron_systeem text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taakuitvoering_id text REFERENCES taakuitvoeringen(id) ON DELETE CASCADE,
  vernietigingsobject_id text REFERENCES vernietigingsobjecten(id) ON DELETE SET NULL,
  actor text NOT NULL DEFAULT 'system',
  event_type text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vernietigingsresultaten (
  id text PRIMARY KEY,
  taakuitvoering_id text NOT NULL REFERENCES taakuitvoeringen(id) ON DELETE CASCADE,
  vernietigingsobject_id text REFERENCES vernietigingsobjecten(id) ON DELETE SET NULL,
  titel text NOT NULL,
  stekker text NOT NULL,
  vernietigingsstatus text NOT NULL CHECK (vernietigingsstatus IN ('SUCCES', 'FOUT', 'NIET_GEVONDEN', 'OVERIG')),
  omvang integer,
  vernietigingsdatum text,
  bron_id text,
  code text,
  grondslag text,
  bron_systeem text,
  melding text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taakuitvoeringen_taak_id ON taakuitvoeringen(taak_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_taakuitvoering_id ON dossiers(taakuitvoering_id);
CREATE INDEX IF NOT EXISTS idx_vernietigingsobjecten_dossier_id ON vernietigingsobjecten(dossier_id);
CREATE INDEX IF NOT EXISTS idx_vernietigingsobjecten_review ON vernietigingsobjecten(dossier_id, beoordeeld, uitgesloten);
CREATE INDEX IF NOT EXISTS idx_audit_events_taakuitvoering_id ON audit_events(taakuitvoering_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vernietigingsresultaten_taakuitvoering_id ON vernietigingsresultaten(taakuitvoering_id);

INSERT INTO taken (id, naam, omschrijving, frequentie, eigenaar)
VALUES
  ('2', 'Zorgdomein jaarlijks', 'Jaarlijkse vernietigingslijst voor Zorgdomein.', 'Jaarlijks', 'Jan de Vries')
ON CONFLICT (id) DO UPDATE
SET naam = EXCLUDED.naam,
    omschrijving = EXCLUDED.omschrijving,
    frequentie = EXCLUDED.frequentie,
    eigenaar = EXCLUDED.eigenaar,
    updated_at = now();

INSERT INTO taakuitvoeringen (id, taak_id, status, huidige_stap, gestart_op)
VALUES
  ('2', '2', 'review', 'Beoordelen vernietigingsdossier', '2026-05-10T09:00:00+02:00')
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    huidige_stap = EXCLUDED.huidige_stap,
    gestart_op = EXCLUDED.gestart_op,
    updated_at = now();

WITH upsert_dossier AS (
  INSERT INTO dossiers (taakuitvoering_id, naam, status, metadata)
  VALUES ('2', 'Zorgdomein 2025', 'review', '{"bron": "prototype-seed"}'::jsonb)
  ON CONFLICT (taakuitvoering_id) DO UPDATE
  SET naam = EXCLUDED.naam,
      status = EXCLUDED.status,
      metadata = EXCLUDED.metadata,
      updated_at = now()
  RETURNING id
),
seed AS (
  SELECT
    row_number() OVER ()::text AS id,
    titel,
    omvang,
    bewaartermijn,
    vernietigingsdatum,
    uitgesloten,
    reden,
    toelichting,
    proceseigenaar_toelichting,
    archivaris_toelichting,
    bron_id,
    code,
    startdatum,
    einddatum,
    selectielijst,
    resultaat,
    grondslag,
    bron_systeem
  FROM (
    SELECT
      1 AS sort_order,
      'Contracten 2021 - Leveranciers' AS titel,
      3 AS omvang,
      7 AS bewaartermijn,
      '2026-01' AS vernietigingsdatum,
      false AS uitgesloten,
      NULL::text AS reden,
      NULL::text AS toelichting,
      'Kan worden vastgesteld.' AS proceseigenaar_toelichting,
      NULL::text AS archivaris_toelichting,
      'ZRC-2021-00441' AS bron_id,
      '7.1.2' AS code,
      '01-2021' AS startdatum,
      '12-2021' AS einddatum,
      'VNG 2017' AS selectielijst,
      'Verleend' AS resultaat,
      'Art. 3 Archiefwet' AS grondslag,
      'Zaaksysteem A' AS bron_systeem
    UNION ALL
    SELECT
      2,
      'Projectdossier X',
      5,
      10,
      '2025-12',
      true,
      'Onbekend recordtype',
      '',
      NULL,
      NULL,
      'ZRC-2020-00182',
      '10.3.1',
      '03-2020',
      '11-2020',
      'VNG 2017',
      'Geweigerd',
      'Art. 5 Archiefbesluit',
      'DMS B'
    UNION ALL
    SELECT
      record_number AS sort_order,
      (ARRAY[
        'Contractdossier',
        'Projectdossier',
        'Subsidieaanvraag',
        'Inkoopdossier',
        'Vergunningzaak',
        'Personeelsmutatie',
        'Meldingsdossier',
        'Auditdocument'
      ])[((index_value % 8) + 1)] || ' ' || (2018 + (index_value % 7)) || '-' || lpad(record_number::text, 3, '0'),
      (index_value % 9) + 1,
      (ARRAY[3, 5, 7, 10, 15])[((index_value % 5) + 1)],
      ((2018 + (index_value % 7)) + 5) || '-' || lpad(((index_value % 12) + 1)::text, 2, '0'),
      record_number % 11 = 0,
      CASE WHEN record_number % 11 = 0 THEN 'Controle vereist' END,
      CASE WHEN record_number % 11 = 0 THEN 'Nog beoordelen voor uitsluiting.' END,
      CASE WHEN record_number % 4 = 0 THEN 'Controle uitgevoerd.' END,
      CASE WHEN record_number % 6 = 0 THEN 'Past binnen selectielijst.' END,
      'ZRC-' || (2018 + (index_value % 7)) || '-' || lpad((400 + record_number)::text, 5, '0'),
      ((index_value % 12) + 1) || '.' || ((index_value % 5) + 1) || '.' || ((index_value % 3) + 1),
      lpad(((index_value % 12) + 1)::text, 2, '0') || '-' || (2018 + (index_value % 7)),
      lpad((((index_value + 5) % 12) + 1)::text, 2, '0') || '-' || (2018 + (index_value % 7)),
      CASE WHEN index_value % 2 = 0 THEN 'VNG 2017' ELSE 'VNG 2020' END,
      (ARRAY[
        'Verleend',
        'Geweigerd',
        'Ingetrokken',
        'Buiten behandeling gesteld',
        'Niet ontvankelijk'
      ])[((index_value % 5) + 1)],
      (ARRAY[
        'Art. 3 Archiefwet',
        'Art. 5 Archiefbesluit',
        'Selectielijst 2020',
        'Mandaatbesluit DIV'
      ])[((index_value % 4) + 1)],
      (ARRAY[
        'Zaaksysteem A',
        'DMS B',
        'Archiefportaal C',
        'Taakapplicatie D'
      ])[((index_value % 4) + 1)]
    FROM (
      SELECT generate_series(0, 117) AS index_value, generate_series(3, 120) AS record_number
    ) generated
  ) rows
  ORDER BY sort_order
)
INSERT INTO vernietigingsobjecten (
  id,
  dossier_id,
  titel,
  omvang,
  bewaartermijn,
  vernietigingsdatum,
  beoordeeld,
  uitgesloten,
  reden,
  toelichting,
  proceseigenaar_toelichting,
  archivaris_toelichting,
  bron_id,
  code,
  startdatum,
  einddatum,
  selectielijst,
  resultaat,
  grondslag,
  bron_systeem
)
SELECT
  seed.id,
  upsert_dossier.id,
  seed.titel,
  seed.omvang,
  seed.bewaartermijn,
  seed.vernietigingsdatum,
  false,
  seed.uitgesloten,
  seed.reden,
  seed.toelichting,
  seed.proceseigenaar_toelichting,
  seed.archivaris_toelichting,
  seed.bron_id,
  seed.code,
  seed.startdatum,
  seed.einddatum,
  seed.selectielijst,
  seed.resultaat,
  seed.grondslag,
  seed.bron_systeem
FROM seed
CROSS JOIN upsert_dossier
ON CONFLICT (id) DO UPDATE
SET titel = EXCLUDED.titel,
    omvang = EXCLUDED.omvang,
    bewaartermijn = EXCLUDED.bewaartermijn,
    vernietigingsdatum = EXCLUDED.vernietigingsdatum,
    uitgesloten = EXCLUDED.uitgesloten,
    reden = EXCLUDED.reden,
    toelichting = EXCLUDED.toelichting,
    proceseigenaar_toelichting = EXCLUDED.proceseigenaar_toelichting,
    archivaris_toelichting = EXCLUDED.archivaris_toelichting,
    bron_id = EXCLUDED.bron_id,
    code = EXCLUDED.code,
    startdatum = EXCLUDED.startdatum,
    einddatum = EXCLUDED.einddatum,
    selectielijst = EXCLUDED.selectielijst,
    resultaat = EXCLUDED.resultaat,
    grondslag = EXCLUDED.grondslag,
    bron_systeem = EXCLUDED.bron_systeem,
    updated_at = now();

INSERT INTO vernietigingsresultaten (
  id,
  taakuitvoering_id,
  vernietigingsobject_id,
  titel,
  stekker,
  vernietigingsstatus,
  omvang,
  vernietigingsdatum,
  bron_id,
  code,
  grondslag,
  bron_systeem,
  melding
)
VALUES
  ('res-1', '2', '1', 'Contracten 2021 - Leveranciers', 'Zaaksysteem A', 'SUCCES', 3, '2026-01', 'ZRC-2021-00441', '7.1.2', 'Art. 3 Archiefwet', 'Zorgdomein', 'Object succesvol verwijderd.'),
  ('res-2', '2', '2', 'Projectdossier X', 'DMS B', 'FOUT', 5, '2025-12', 'ZRC-2020-00182', '10.3.1', 'Art. 5 Archiefbesluit', 'Zorgdomein', 'Connector gaf een autorisatiefout terug.'),
  ('res-3', '2', NULL, 'Vergunningdossier wijkteam', 'SharePoint Documenten', 'NIET_GEVONDEN', 2, '2026-03', 'SP-2022-1038', '3.4.8', 'Lokale selectielijst', 'SharePoint', 'Record niet meer aanwezig in de bron.'),
  ('res-4', '2', NULL, 'Mailbox export inkoop', 'Outlook', 'OVERIG', 1, '2026-02', 'OUT-77821', '9.2.1', 'Art. 12 Archiefregeling', 'Exchange Online', 'Object overgeslagen wegens actief bewaarbeleid.'),
  ('res-5', '2', NULL, 'Topdesk wijzigingsverzoek 884', 'Topdesk', 'SUCCES', 1, '2026-04', 'TD-884', '5.6.4', 'Selectielijst gemeenten 2020', 'Topdesk', 'Object succesvol verwijderd.')
ON CONFLICT (id) DO UPDATE
SET titel = EXCLUDED.titel,
    stekker = EXCLUDED.stekker,
    vernietigingsstatus = EXCLUDED.vernietigingsstatus,
    omvang = EXCLUDED.omvang,
    vernietigingsdatum = EXCLUDED.vernietigingsdatum,
    bron_id = EXCLUDED.bron_id,
    code = EXCLUDED.code,
    grondslag = EXCLUDED.grondslag,
    bron_systeem = EXCLUDED.bron_systeem,
    melding = EXCLUDED.melding;

INSERT INTO audit_events (taakuitvoering_id, actor, event_type, message, payload)
SELECT '2', 'system', 'seed.applied', 'Prototype-data gemigreerd naar PostgreSQL.', '{"migration": "001_init_persistent_storage"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM audit_events
  WHERE taakuitvoering_id = '2'
    AND event_type = 'seed.applied'
);
