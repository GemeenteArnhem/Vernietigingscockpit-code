import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import type { AppRole } from "../auth/app-role.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { mapAfdeling, mapMedewerker } from "./stamgegevens.dto.js";
import type { StamgegevensImportInput } from "./stamgegevens.service.js";
import { StamgegevensService } from "./stamgegevens.service.js";

@Controller("stamgegevens")
export class StamgegevensController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StamgegevensService)
    private readonly stamgegevensService: StamgegevensService
  ) {}

  @Post("import")
  @Roles("functioneel_beheerder")
  importStamgegevens(
    @CurrentUser() user: AuthUser,
    @Body() body: StamgegevensImportInput
  ) {
    return this.stamgegevensService.importStamgegevens(user, body);
  }

  @Get("afdelingen")
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  async getAfdelingen() {
    const afdelingen = await this.prisma.client.afdeling.findMany({
      orderBy: { naam: "asc" },
    });

    return afdelingen.map(mapAfdeling);
  }

  @Get("medewerkers")
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  async getMedewerkers(@Query("rol") rol?: AppRole) {
    const medewerkers = await this.prisma.client.medewerker.findMany({
      where: {
        actief: true,
        ...(rol ? { rollen: { has: rol } } : {}),
      },
      include: {
        afdeling: true,
      },
      orderBy: { naam: "asc" },
    });

    return medewerkers.map(mapMedewerker);
  }
}
