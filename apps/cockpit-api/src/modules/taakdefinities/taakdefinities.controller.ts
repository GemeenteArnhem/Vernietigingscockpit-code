import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import type { CreateTaakdefinitieInput } from "./taakdefinities.service.js";
import type { CreateTaakinstantieInput } from "./taakdefinities.service.js";
import { TaakdefinitiesService } from "./taakdefinities.service.js";
import { UUID, ZodPipe } from "../../shared/http/validatie.js";
import { scopeSchema, taakdefinitieSchema, taakinstantieSchema } from "@vernietigingscockpit/api-contract";

@Controller("taakdefinities")
export class TaakdefinitiesController {
  constructor(
    @Inject(TaakdefinitiesService)
    private readonly taakdefinitiesService: TaakdefinitiesService
  ) {}

  // De functioneel beheerder maakt taken aan voor een gekozen recordmanager.
  @Post()
  @Roles("recordmanager", "functioneel_beheerder")
  createTaakdefinitie(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(taakdefinitieSchema)) body: CreateTaakdefinitieInput
  ) {
    return this.taakdefinitiesService.createTaakdefinitie(user, body);
  }

  @Post(":id/instanties")
  @Roles("recordmanager", "functioneel_beheerder")
  createTaakinstantie(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Body(new ZodPipe(taakinstantieSchema)) body: CreateTaakinstantieInput
  ) {
    return this.taakdefinitiesService.createTaakinstantie(user, id, body);
  }

  @Get()
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  getTaakdefinities(
    @CurrentUser() user: AuthUser,
    @Query("scope", new ZodPipe(scopeSchema)) scope: "mijn" | "alle"
  ) {
    return this.taakdefinitiesService.getTaakdefinities(user, scope);
  }

  @Get(":id")
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  getTaakdefinitie(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.taakdefinitiesService.getTaakdefinitie(user, id);
  }

  // Verwijderen (functioneel beheerder): echt als er nooit uitvoeringen waren, anders logisch
  // met behoud van het auditlog. Zie TaakdefinitiesService.verwijderTaakdefinitie.
  @Delete(":id")
  @HttpCode(204)
  @Roles("functioneel_beheerder")
  async verwijderTaakdefinitie(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    await this.taakdefinitiesService.verwijderTaakdefinitie(user, id);
  }

  @Delete(":id/instanties/:instantieId")
  @HttpCode(204)
  @Roles("functioneel_beheerder")
  async verwijderTaakinstantie(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Param("instantieId", UUID) instantieId: string
  ) {
    await this.taakdefinitiesService.verwijderTaakinstantie(user, id, instantieId);
  }
}
