import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { StekkersController } from "./stekkers.controller.js";

@Module({
  imports: [DatabaseModule],
  controllers: [StekkersController],
})
export class StekkersModule {}
