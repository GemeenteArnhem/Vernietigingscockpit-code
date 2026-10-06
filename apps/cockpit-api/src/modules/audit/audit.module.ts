import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuditController } from "./audit.controller.js";
import { AuditService } from "./audit.service.js";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
