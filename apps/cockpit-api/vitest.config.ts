import { defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

// Gedeelde pakketten (packages/*) direct uit de TypeScript-bron, zonder eerst te bouwen.
const BRON = ["source", ...defaultServerConditions];

// Alleen via `npm run test:e2e`: dat script zet VITEST_E2E=1 en start de omgeving uit
// infrastructure/compose/docker-compose.test.yml.
const e2eProject = {
  test: {
    name: "e2e",
    include: ["test/e2e/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
};

export default defineConfig({
  resolve: { conditions: BRON },
  ssr: { resolve: { conditions: BRON, externalConditions: ["source"] } },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integratie",
          include: ["test/integratie/**/*.test.ts"],
          environment: "node",
          // Eén PostgreSQL-container per testbestand; bestanden na elkaar.
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 180_000,
        },
      },
      ...(process.env.VITEST_E2E === "1" ? [e2eProject] : []),
    ],
  },
});
