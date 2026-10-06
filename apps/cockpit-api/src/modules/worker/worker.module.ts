import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { StekkerClient } from "../stekker/stekker-client.js";
import { WorkflowModule } from "../workflow/workflow.module.js";
import { SelectieWorkerService } from "./selectie-worker.service.js";

@Module({
  imports: [DatabaseModule, WorkflowModule],
  providers: [
    SelectieWorkerService,
    // Eén client per proces, zodat OAuth2-tokens per stekkerconfiguratie gedeeld worden.
    { provide: StekkerClient, useFactory: () => new StekkerClient() },
  ],
})
export class WorkerModule {}
