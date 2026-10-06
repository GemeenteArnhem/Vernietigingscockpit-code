import { Controller, Get, Inject } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { StekkersService } from "./stekkers.service.js";

@Controller("stekkers")
export class StekkersController {
  constructor(@Inject(StekkersService) private readonly stekkersService: StekkersService) {}

  @Get()
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  getStekkers() {
    return this.stekkersService.getStekkers();
  }
}
