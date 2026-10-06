import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./modules/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>("CORS_ORIGIN");

  app.useLogger(app.get(Logger));
  // Bulkverzoeken (CC-10) bevatten tot 20.000 id's (~750 kB); de standaard is 100 kB.
  app.useBodyParser("json", { limit: "1mb" });
  app.setGlobalPrefix("api/v1");

  // Security-headers, zonder X-Powered-By (CC-11). De API levert alleen JSON en bestanden.
  app.use(helmet());
  app.disable("x-powered-by");

  // Achter Traefik: het echte client-IP uit X-Forwarded-For, maar alleen van proxies op
  // interne netwerken (Docker). Nodig voor de rate limit per IP.
  app.set("trust proxy", config.get<string>("TRUST_PROXY") ?? "loopback, linklocal, uniquelocal");

  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(",").map((origin) => origin.trim()),
      // Geen cookies: de web-app stuurt een Bearer-token.
      credentials: false,
      allowedHeaders: ["Authorization", "Content-Type", "If-Match", "X-Correlation-ID"],
      exposedHeaders: ["ETag", "X-Correlation-ID"],
    });
  }

  // SIGTERM (docker stop): netjes afsluiten, lopende verzoeken en databaseverbindingen.
  app.enableShutdownHooks();

  await app.listen(config.get<number>("PORT") ?? 3000);
}

void bootstrap();
