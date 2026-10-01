import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import {
  mapTaakdefinitieMetActies,
  taakdefinitieSelect,
} from "./taakdefinities.dto.js";
import type { CreateTaakdefinitieInput } from "./taakdefinities.service.js";
import type { CreateTaakinstantieInput } from "./taakdefinities.service.js";
import { TaakdefinitiesService } from "./taakdefinities.service.js";
import {
  taakdefinitieActies,
  taakinstantieActies,
} from "../workflow/toegestane-acties.js";

@Controller("taakdefinities")
export class TaakdefinitiesController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService)
    private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(TaakdefinitiesService)
    private readonly taakdefinitiesService: TaakdefinitiesService
  ) {}

  @Post()
  @Roles("recordmanager")
  createTaakdefinitie(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTaakdefinitieInput
  ) {
    return this.taakdefinitiesService.createTaakdefinitie(user, body);
  }

  @Post(":id/instanties")
  @Roles("recordmanager")
  createTaakinstantie(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: CreateTaakinstantieInput
  ) {
    return this.taakdefinitiesService.createTaakinstantie(user, id, body);
  }

  @Get()
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  async getTaakdefinities(
    @CurrentUser() user: AuthUser,
    @Query("scope") scope: "mijn" | "alle" = "mijn"
  ) {
    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const where = await this.buildAccessWhere(user, scope);
    const taakdefinities = await this.prisma.client.taakdefinitie.findMany({
      where,
      select: taakdefinitieSelect,
      orderBy: { naam: "asc" },
    });

    return taakdefinities.map((taakdefinitie) =>
      mapTaakdefinitieMetActies(
        taakdefinitie,
        taakdefinitieActies(taakdefinitie, {
          roles: user.roles,
          medewerkerId,
        }),
        (instantie) =>
          taakinstantieActies(instantie, {
            roles: user.roles,
            medewerkerId,
          })
      )
    );
  }

  @Get(":id")
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  async getTaakdefinitie(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const taakdefinitie = await this.prisma.client.taakdefinitie.findFirstOrThrow({
      where: {
        id,
        ...(await this.buildDetailAccessWhere(user)),
      },
      select: taakdefinitieSelect,
    });

    return mapTaakdefinitieMetActies(
      taakdefinitie,
      taakdefinitieActies(taakdefinitie, {
        roles: user.roles,
        medewerkerId,
      }),
      (instantie) =>
        taakinstantieActies(instantie, {
          roles: user.roles,
          medewerkerId,
        })
    );
  }

  private async buildAccessWhere(user: AuthUser, scope: "mijn" | "alle") {
    const canSeeAll =
      user.roles.includes("auditor") ||
      user.roles.includes("functioneel_beheerder");

    if (scope === "alle" && canSeeAll) {
      return undefined;
    }

    const medewerkerId = await this.currentMedewerker.findForUser(user);

    if (!medewerkerId) {
      return { id: { equals: "00000000-0000-0000-0000-000000000000" } };
    }

    return {
      OR: [
        { recordmanagerId: medewerkerId },
        { proceseigenaarId: medewerkerId },
        { archivarisId: medewerkerId },
      ],
    };
  }

  private buildDetailAccessWhere(user: AuthUser) {
    const canSeeAll =
      user.roles.includes("auditor") ||
      user.roles.includes("functioneel_beheerder");

    return this.buildAccessWhere(user, canSeeAll ? "alle" : "mijn");
  }
}
