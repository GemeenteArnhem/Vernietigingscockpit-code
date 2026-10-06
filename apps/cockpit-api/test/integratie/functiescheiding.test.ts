import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { TaakdefinitiesService } from "../../src/modules/taakdefinities/taakdefinities.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";

const migratie = fs.readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../prisma/migrations/20261002120000_functiescheiding_rm_po/migration.sql"
  ),
  "utf8"
);
// Alleen het controleblok vooraf (DO $$ … END $$;), niet de ALTER TABLE-statements.
const migratieControle = migratie.slice(migratie.indexOf("DO $$"), migratie.indexOf("END $$;") + "END $$;".length);

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let service: TaakdefinitiesService;

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  service = new TaakdefinitiesService(db.prisma, new CurrentMedewerkerService(db.prisma));
});

afterAll(async () => {
  await db?.stop();
});

const definitie = (overrides: Record<string, string>) => ({
  naam: "Testdefinitie",
  categorie: "Test",
  frequentie: "ad_hoc" as const,
  recordmanagerId: basis.rm.id,
  proceseigenaarId: basis.po.id,
  archivarisId: basis.arch.id,
  ...overrides,
});

describe("functiescheiding bij het aanmaken van een taakdefinitie", () => {
  it.each([
    ["recordmanager = proceseigenaar", () => ({ proceseigenaarId: basis.rm.id })],
    ["recordmanager = archivaris", () => ({ archivarisId: basis.rm.id })],
    ["proceseigenaar = archivaris", () => ({ archivarisId: basis.po.id })],
  ])("weigert %s met 400", async (_omschrijving, overrides) => {
    await expect(
      service.createTaakdefinitie(gebruiker("rm1", "recordmanager"), definitie(overrides()))
    ).rejects.toThrow(/drie verschillende personen/);
  });

  it("accepteert drie verschillende personen", async () => {
    const aangemaakt = await service.createTaakdefinitie(gebruiker("rm1", "recordmanager"), definitie({}));
    expect(aangemaakt.id).toBeTruthy();
  });
});

describe("functiescheiding in de database", () => {
  const rijen = () => [
    ["recordmanager = proceseigenaar", { recordmanagerId: basis.rm.id, proceseigenaarId: basis.rm.id, archivarisId: basis.arch.id }],
    ["recordmanager = archivaris", { recordmanagerId: basis.rm.id, proceseigenaarId: basis.po.id, archivarisId: basis.rm.id }],
    ["proceseigenaar = archivaris", { recordmanagerId: basis.rm.id, proceseigenaarId: basis.po.id, archivarisId: basis.po.id }],
  ] as const;

  it("weigert elke overlap in taakdefinitie, ook buiten de service om", async () => {
    for (const [omschrijving, rollen] of rijen()) {
      await expect(
        db.prisma.client.taakdefinitie.create({ data: { naam: "x", categorie: "x", frequentie: "ad_hoc", ...rollen } }),
        omschrijving
      ).rejects.toThrow(/taakdefinitie_functiescheiding/);
    }
  });

  it("weigert elke overlap in taakinstantie, ook buiten de service om", async () => {
    for (const [omschrijving, rollen] of rijen()) {
      await expect(
        db.prisma.client.taakinstantie.create({
          data: { taakdefinitieId: basis.taakdefinitie.id, naam: "x", status: "init", ...rollen },
        }),
        omschrijving
      ).rejects.toThrow(/taakinstantie_functiescheiding/);
    }
  });
});

describe("migratie met bestaande overtreders", () => {
  it("stopt en noemt de id van de overtredende taakinstantie", async () => {
    const client = db.prisma.client;
    // Situatie vóór de migratie nabootsen: constraint tijdelijk weg, overtreder erin.
    await client.$executeRawUnsafe('ALTER TABLE "taakinstantie" DROP CONSTRAINT "taakinstantie_functiescheiding"');
    const overtreder = await client.taakinstantie.create({
      data: {
        taakdefinitieId: basis.taakdefinitie.id,
        naam: "Oud",
        status: "init",
        recordmanagerId: basis.rm.id,
        proceseigenaarId: basis.rm.id,
        archivarisId: basis.arch.id,
      },
    });

    await expect(client.$executeRawUnsafe(migratieControle)).rejects.toThrow(new RegExp(overtreder.id));
  });
});
