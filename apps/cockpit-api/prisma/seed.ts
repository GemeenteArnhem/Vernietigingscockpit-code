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

// Vaste id's (geldige UUID's), zodat de seed bij elke start opnieuw kan draaien zonder
// dubbele gegevens. Taakuitvoeringen maakt de seed bewust niet: die maak je in de cockpit,
// zodat het auditlog met Creatie begint.
const TEST_STEKKER_ID = "f6d4934b-4073-4763-8212-b460d662e6a9";
const TEST_TAAKDEFINITIE_ID = "ccc80546-381c-4e21-afda-7d430c0e60aa";

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

  // De archiefvormer staat op het profiel van de proceseigenaar (ADR-0005, B-M3).
  const archiefvormer = { verwijzingNaam: "Gemeente Voorbeeld" };
  const po = await prisma.medewerker.upsert({
    where: { email: "peter.proceseigenaar@example.local" },
    update: { archiefvormer },
    create: {
      archiefvormer,
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

  // Verbinding met de teststekker uit env, zodat de seed bij elke omgeving past.
  // Standaard lokaal zonder authenticatie ('none' mag alleen buiten productie);
  // met SEED_STEKKER_AUTH_TYPE=oauth2_cc gelden tokenUrl, clientId en het secret
  // uit de env-variabele die in secretRef staat. Standaard poort 3100: de API gebruikt 3000,
  // dus de teststekker draait lokaal met PORT=3100.
  const stekkerVerbinding = {
    baseUrl: process.env.SEED_STEKKER_BASE_URL ?? "http://localhost:3100",
    authType: process.env.SEED_STEKKER_AUTH_TYPE ?? "none",
    tokenUrl: process.env.SEED_STEKKER_TOKEN_URL ?? null,
    clientId: process.env.SEED_STEKKER_CLIENT_ID ?? "cockpit-stekker",
    secretRef: process.env.SEED_STEKKER_SECRET_REF ?? "KC_STEKKER_CLIENT_SECRET",
  };

  await prisma.stekkerConfiguratie.upsert({
    where: {
      stekkerId_versie: {
        stekkerId: stekker.id,
        versie: 1,
      },
    },
    update: stekkerVerbinding,
    create: {
      stekkerId: stekker.id,
      versie: 1,
      ...stekkerVerbinding,
      scopes: ["selectie.read", "selectie.write", "vernietiging.read", "vernietiging.write"],
      parameters: {},
      verwachteApiMajor: 2,
      timeouts: { connectMs: 5000, requestMs: 30000 },
      aangemaaktDoor: "seed",
    },
  });

  await prisma.taakdefinitie.upsert({
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
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
