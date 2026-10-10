import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DossiersController, WerkkopieInstellingController } from "./werkkopie.controller.js";
import { WerkkopieService } from "./werkkopie.service.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WerkkopieInstellingController, DossiersController],
  providers: [WerkkopieService],
})
export class WerkkopieModule {}
