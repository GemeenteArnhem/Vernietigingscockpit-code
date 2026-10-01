import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { TaakdefinitiesController } from "./taakdefinities.controller.js";
import { TaakdefinitiesService } from "./taakdefinities.service.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TaakdefinitiesController],
  providers: [TaakdefinitiesService],
})
export class TaakdefinitiesModule {}
