import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { HealthService } from "./health.service.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  getLive() {
    return this.health.getLive();
  }

  @Get("ready")
  getReady() {
    return this.health.getReady();
  }
}
