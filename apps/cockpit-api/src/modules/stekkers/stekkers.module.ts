import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { StekkerbeheerController } from "./stekkerbeheer.controller.js";
import { StekkerbeheerService } from "./stekkerbeheer.service.js";
import { StekkersController } from "./stekkers.controller.js";
import { StekkersService } from "./stekkers.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [StekkersController, StekkerbeheerController],
  providers: [StekkersService, StekkerbeheerService],
})
export class StekkersModule {}
