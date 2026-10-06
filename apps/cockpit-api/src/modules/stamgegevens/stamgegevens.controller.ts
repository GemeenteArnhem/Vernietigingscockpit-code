import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import type { AppRole } from "../auth/app-role.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import type { StamgegevensImportInput } from "./stamgegevens.service.js";
import { StamgegevensService } from "./stamgegevens.service.js";
import { ZodPipe } from "../../shared/http/validatie.js";
import { rolQuerySchema, stamgegevensImportSchema } from "@vernietigingscockpit/api-contract";

@Controller("stamgegevens")
export class StamgegevensController {
  constructor(
    @Inject(StamgegevensService)
    private readonly stamgegevensService: StamgegevensService
  ) {}

  @Post("import")
  @Roles("functioneel_beheerder")
  importStamgegevens(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(stamgegevensImportSchema)) body: StamgegevensImportInput
  ) {
    return this.stamgegevensService.importStamgegevens(user, body);
  }

  @Get("afdelingen")
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  getAfdelingen() {
    return this.stamgegevensService.getAfdelingen();
  }

  @Get("medewerkers")
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  getMedewerkers(@Query("rol", new ZodPipe(rolQuerySchema)) rol?: AppRole) {
    return this.stamgegevensService.getMedewerkers(rol);
  }
}
