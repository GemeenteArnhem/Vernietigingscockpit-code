import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { StamgegevensController } from "./stamgegevens.controller.js";
import { StamgegevensService } from "./stamgegevens.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [StamgegevensController],
  providers: [StamgegevensService],
})
export class StamgegevensModule {}
