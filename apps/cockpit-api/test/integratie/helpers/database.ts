import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../src/shared/db/prisma.service.js";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

export type TestDatabase = {
  // Eigenaar (superuser in de container): voor opzet van testdata en DDL.
  url: string;
  // Loginrol van de API, lid van <database>_app (ADR-0003).
  appUrl: string;
  prisma: PrismaService;
  config: ConfigService;
  stop: () => Promise<void>;
};

// Start een lege PostgreSQL in een container en voert de echte Prisma-migraties uit,
// zodat triggers, constraints en indexen precies zo zijn als in productie.
export async function startDatabase(): Promise<TestDatabase> {
  // Wegwerpdatabase per testbestand: een willekeurig wachtwoord voor de applicatierol.
  const appWachtwoord = randomBytes(18).toString("base64url");
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = `${container.getConnectionUri()}?schema=public&sslmode=disable`;

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  // Zelfde stap als in productie: de loginrol voor de API aanmaken.
  execFileSync(process.execPath, [path.join(apiDir, "scripts", "db-app-gebruiker.mjs")], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: url, APP_DB_USER: "cockpit_api", APP_DB_PASSWORD: appWachtwoord },
    stdio: "pipe",
  });
  const appUrl = new URL(url);
  appUrl.username = "cockpit_api";
  appUrl.password = appWachtwoord;

  const config = new ConfigService({ DATABASE_URL: url });
  const prisma = new PrismaService(config);

  return {
    url,
    appUrl: appUrl.toString(),
    prisma,
    config,
    stop: async () => {
      await prisma.client.$disconnect();
      await container.stop();
    },
  };
}
