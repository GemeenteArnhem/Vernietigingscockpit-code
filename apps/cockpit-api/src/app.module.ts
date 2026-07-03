import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { BesluitvormingModule } from './modules/besluitvorming/besluitvorming.module';
import { DossierModule } from './modules/dossier/dossier.module';
import { StartentaakModule } from './modules/startentaak/startentaak.module';
import { StekkerModule } from './modules/stekker/stekker.module';
import { UitvoeringModule } from './modules/uitvoering/uitvoering.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    StartentaakModule,
    WorkflowModule,
    DossierModule,
    BesluitvormingModule,
    UitvoeringModule,
    StekkerModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
