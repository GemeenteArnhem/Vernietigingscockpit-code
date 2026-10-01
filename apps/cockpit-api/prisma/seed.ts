import { config as loadEnv } from "dotenv";
import { createPrismaClient } from "../src/shared/db/prisma-client.js";

loadEnv({ path: "apps/cockpit-api/.env.local" });
loadEnv({ path: "apps/cockpit-api/.env" });
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL ontbreekt.");
}

const prisma = createPrismaClient(databaseUrl);

const TEST_STEKKER_ID = "00000000-0000-0000-0000-000000000101";
const TEST_TAAKDEFINITIE_ID = "00000000-0000-0000-0000-000000000201";
const TEST_TAAK_INSTANTIE_ID = "00000000-0000-0000-0000-000000000301";

async function main() {
  const afdeling = await prisma.afdeling.upsert({
    where: { code: "SD" },
    update: {},
    create: {
      code: "SD",
      naam: "Sociaal domein",
    },
  });

  const rm = await prisma.medewerker.upsert({
    where: { email: "rita.recordmanager@example.local" },
    update: {},
    create: {
      naam: "Rita Recordmanager",
      email: "rita.recordmanager@example.local",
      rollen: ["recordmanager"],
      afdelingId: afdeling.id,
      bron: "seed",
      externId: "rm1",
    },
  });

  const po = await prisma.medewerker.upsert({
    where: { email: "peter.proceseigenaar@example.local" },
    update: {},
    create: {
      naam: "Peter Proceseigenaar",
      email: "peter.proceseigenaar@example.local",
      rollen: ["proceseigenaar"],
      afdelingId: afdeling.id,
      bron: "seed",
      externId: "po1",
    },
  });

  const arch = await prisma.medewerker.upsert({
    where: { email: "anna.archivaris@example.local" },
    update: {},
    create: {
      naam: "Anna Archivaris",
      email: "anna.archivaris@example.local",
      rollen: ["archivaris"],
      afdelingId: afdeling.id,
      bron: "seed",
      externId: "arch1",
    },
  });

  const stekker = await prisma.stekker.upsert({
    where: { id: TEST_STEKKER_ID },
    update: {},
    create: {
      id: TEST_STEKKER_ID,
      naam: "Teststekker sociaal domein",
      omschrijving: "Lokale CSV-teststekker voor F3/F4",
    },
  });

  await prisma.stekkerConfiguratie.upsert({
    where: {
      stekkerId_versie: {
        stekkerId: stekker.id,
        versie: 1,
      },
    },
    update: {},
    create: {
      stekkerId: stekker.id,
      versie: 1,
      baseUrl: "http://localhost:3002",
      authType: "oauth2_cc",
      tokenUrl:
        "https://auth.cockpit.arnhem.dev/realms/vernietigingscockpit/protocol/openid-connect/token",
      clientId: "cockpit-stekker",
      secretRef: "KC_STEKKER_CLIENT_SECRET",
      scopes: ["selectie.read", "selectie.write", "vernietiging.read", "vernietiging.write"],
      parameters: {},
      verwachteApiMajor: 1,
      timeouts: { connectMs: 5000, requestMs: 30000 },
      aangemaaktDoor: "seed",
    },
  });

  const taakdefinitie = await prisma.taakdefinitie.upsert({
    where: { id: TEST_TAAKDEFINITIE_ID },
    update: {},
    create: {
      id: TEST_TAAKDEFINITIE_ID,
      naam: "Sociaal domein 2026",
      omschrijving: "Jaarlijkse vernietigingslijst sociaal domein",
      categorie: "Sociaal domein",
      frequentie: "jaarlijks",
      startmaand: 1,
      recordmanagerId: rm.id,
      proceseigenaarId: po.id,
      archivarisId: arch.id,
      stekkers: {
        create: {
          stekkerId: stekker.id,
          selectieparameters: {
            peildatum: "2026-01-01",
            domein: "sociaal",
          },
        },
      },
    },
  });

  await prisma.taakinstantie.upsert({
    where: { id: TEST_TAAK_INSTANTIE_ID },
    update: {},
    create: {
      id: TEST_TAAK_INSTANTIE_ID,
      taakdefinitieId: taakdefinitie.id,
      naam: "Sociaal domein 2026",
      status: "init",
      peildatum: new Date("2026-01-01"),
      recordmanagerId: rm.id,
      proceseigenaarId: po.id,
      archivarisId: arch.id,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
