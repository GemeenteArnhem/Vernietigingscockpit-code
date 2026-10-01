import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { MeController } from "./me.controller.js";
import { MeService } from "./me.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
