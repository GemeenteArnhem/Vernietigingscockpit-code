-- Functiescheiding (governance §10, bouwplan §4.2): recordmanager, proceseigenaar en
-- archivaris zijn drie verschillende personen, zowel op de taakdefinitie als op de
-- taakinstantie (die een eigen snapshot van de drie rollen heeft).
--
-- Bestaande overtreders worden niet stil aangepast: de migratie stopt dan en noemt de id's.

DO $$
DECLARE
  overtreders text;
BEGIN
  SELECT string_agg(id::text, ', ')
    INTO overtreders
    FROM "taakdefinitie"
   WHERE "recordmanager_id" = "proceseigenaar_id";

  IF overtreders IS NOT NULL THEN
    RAISE EXCEPTION 'Functiescheiding: taakdefinities waarin recordmanager en proceseigenaar dezelfde persoon zijn: %. Pas deze eerst aan.', overtreders;
  END IF;

  SELECT string_agg(id::text, ', ')
    INTO overtreders
    FROM "taakinstantie"
   WHERE "recordmanager_id" = "proceseigenaar_id"
      OR "recordmanager_id" = "archivaris_id"
      OR "proceseigenaar_id" = "archivaris_id";

  IF overtreders IS NOT NULL THEN
    RAISE EXCEPTION 'Functiescheiding: taakinstanties waarin twee rollen dezelfde persoon zijn: %. Pas deze eerst aan.', overtreders;
  END IF;
END $$;

ALTER TABLE "taakdefinitie" DROP CONSTRAINT "taakdefinitie_functiescheiding";

ALTER TABLE "taakdefinitie" ADD CONSTRAINT "taakdefinitie_functiescheiding" CHECK (
  "recordmanager_id" <> "proceseigenaar_id"
  AND "recordmanager_id" <> "archivaris_id"
  AND "proceseigenaar_id" <> "archivaris_id"
);

ALTER TABLE "taakinstantie" ADD CONSTRAINT "taakinstantie_functiescheiding" CHECK (
  "recordmanager_id" <> "proceseigenaar_id"
  AND "recordmanager_id" <> "archivaris_id"
  AND "proceseigenaar_id" <> "archivaris_id"
);
