import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { TakenController } from "./taken.controller.js";
import { TakenService } from "./taken.service.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TakenController],
  providers: [TakenService],
})
export class TakenModule {}
