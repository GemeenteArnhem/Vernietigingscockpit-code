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
    // Testdekking (NeRDS-leidraad 13.1): alleen met `npm run test:dekking`, dat unit- en
    // integratietests samen draait en één rapport maakt. De drempels werken als ratchet:
    // gelijk aan de laatst gemeten dekking (naar beneden afgerond), zodat die niet daalt.
    // Verhoog ze als de dekking stijgt. Gemeten 2026-11-13: lines 80,4%, branches 75,9%,
    // functions 79,2%, statements 80,6%.
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        // Gegenereerd uit het register in de architectuurrepo (check:selectielijsten).
        "src/modules/selectielijsten/register.ts",
      ],
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 79,
        statements: 80,
      },
    },
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
