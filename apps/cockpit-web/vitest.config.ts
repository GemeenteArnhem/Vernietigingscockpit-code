import react from "@vitejs/plugin-react";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

// Gedeelde pakketten (packages/*) direct uit de TypeScript-bron, zonder eerst te bouwen.
const BRON = ["source", ...defaultClientConditions];

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: BRON },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    // axe op hele pagina's in jsdom kost tijd.
    testTimeout: 30_000,
    // Testdekking (NeRDS-leidraad 13.1) met `npm run test:dekking`. Ratchet: de drempels zijn
    // de laatst gemeten dekking (naar beneden afgerond); verhoog ze als de dekking stijgt.
    // Gemeten 2026-11-13: lines 42,7%, branches 36,4%, functions 39,2%, statements 42,7%.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx"],
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 42,
        branches: 36,
        functions: 39,
        statements: 42,
      },
    },
  },
});
