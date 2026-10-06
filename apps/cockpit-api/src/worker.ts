import "reflect-metadata";
import { Logger as NestLogger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { loggingModule } from "./shared/logging/logging.js";
import { SelectieWorkerService } from "./modules/worker/selectie-worker.service.js";
import { WorkerModule } from "./modules/worker/worker.module.js";

// Eigen proces voor de worker (CC-7): geen HTTP, alleen de verwerkingsrondes.
// Meerdere instanties naast elkaar zijn veilig: werk wordt geclaimd (FOR UPDATE SKIP LOCKED).
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["apps/cockpit-api/.env.local", "apps/cockpit-api/.env", ".env.local", ".env"],
    }),
    loggingModule(),
    WorkerModule,
  ],
})
class WorkerAppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // SIGTERM/SIGINT (docker stop): lopende ronde afmaken, daarna stoppen.
  app.enableShutdownHooks();
  app.get(SelectieWorkerService).start();
}

bootstrap().catch((error: unknown) => {
  new NestLogger("Worker").error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
