import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { WorkflowModule } from "../workflow/workflow.module.js";
import { TakenController } from "./taken.controller.js";
import { BeoordelingService } from "./beoordeling.service.js";
import { BesluitvormingService } from "./besluitvorming.service.js";
import { DossierService } from "./dossier.service.js";
import { SelectieService } from "./selectie.service.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { UitvoeringService } from "./uitvoering.service.js";

@Module({
  imports: [AuthModule, DatabaseModule, WorkflowModule],
  controllers: [TakenController],
  providers: [
    TaakToegangService,
    SelectieService,
    BeoordelingService,
    BesluitvormingService,
    DossierService,
    UitvoeringService,
  ],
})
export class TakenModule {}
