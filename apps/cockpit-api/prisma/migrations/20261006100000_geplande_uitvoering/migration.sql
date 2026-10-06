-- Geplande taakuitvoering (terugkerende taken): de startdatum van de cyclus. Zolang die in
-- de toekomst ligt, staat de uitvoering in 'init' en kan de selectie nog niet starten.
ALTER TABLE "taakinstantie" ADD COLUMN "gepland_op" DATE;

-- Hoogstens één geplande, nog niet gestarte uitvoering per taakdefinitie.
CREATE UNIQUE INDEX "taakinstantie_een_geplande_per_definitie"
  ON "taakinstantie" ("taakdefinitie_id")
  WHERE "status" = 'init' AND "gepland_op" IS NOT NULL;
