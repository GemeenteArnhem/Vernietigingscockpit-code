import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { StekkersController } from "./stekkers.controller.js";
import { StekkersService } from "./stekkers.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [StekkersController],
  providers: [StekkersService],
})
export class StekkersModule {}
