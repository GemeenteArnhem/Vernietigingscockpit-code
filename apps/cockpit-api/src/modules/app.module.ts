import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.js";
import { MeModule } from "./me/me.module.js";
import { StamgegevensModule } from "./stamgegevens/stamgegevens.module.js";
import { TaakdefinitiesModule } from "./taakdefinities/taakdefinities.module.js";
import { TakenModule } from "./taken/taken.module.js";
import { HealthModule } from "./health/health.module.js";
import { StekkersModule } from "./stekkers/stekkers.module.js";
import { WorkerModule } from "./worker/worker.module.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { RolesGuard } from "./auth/roles.guard.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        "apps/cockpit-api/.env.local",
        "apps/cockpit-api/.env",
        ".env.local",
        ".env",
      ],
    }),
    AuthModule,
    HealthModule,
    MeModule,
    StamgegevensModule,
    StekkersModule,
    TaakdefinitiesModule,
    TakenModule,
    WorkerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
