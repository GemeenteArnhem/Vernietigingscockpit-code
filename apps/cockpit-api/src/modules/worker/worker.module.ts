import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { SelectieWorkerService } from "./selectie-worker.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [SelectieWorkerService],
})
export class WorkerModule {}
