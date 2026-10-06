-- CC-14: alle tijdkolommen als timestamptz. Alleen verklaring.gegenereerd_op was nog een
-- TIMESTAMP(3) zonder tijdzone; Prisma schreef daarin UTC.
ALTER TABLE "verklaring"
  ALTER COLUMN "gegenereerd_op" TYPE timestamptz USING "gegenereerd_op" AT TIME ZONE 'UTC',
  ALTER COLUMN "gegenereerd_op" SET DEFAULT now();
