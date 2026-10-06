import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuditModule } from "./audit/audit.module.js";
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
import { WorkflowModule } from "./workflow/workflow.module.js";
import { NietGevondenFilter } from "../shared/http/niet-gevonden.filter.js";
import { RateLimitGuard, rateLimitOpties } from "../shared/http/rate-limit.js";
import { loggingModule } from "../shared/logging/logging.js";

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
    loggingModule(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => rateLimitOpties(config),
    }),
    AuditModule,
    AuthModule,
    HealthModule,
    MeModule,
    StamgegevensModule,
    StekkersModule,
    TaakdefinitiesModule,
    TakenModule,
    WorkerModule,
    WorkflowModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: NietGevondenFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Na de JwtAuthGuard: dan is de gebruiker bekend (rate limit per sub).
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
