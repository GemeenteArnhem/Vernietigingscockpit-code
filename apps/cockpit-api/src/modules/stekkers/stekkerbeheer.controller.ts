import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Post, Put, Res } from "@nestjs/common";
import { stekkerSchema, type StekkerGevalideerd } from "@vernietigingscockpit/api-contract";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { etagVoorVersie, leesIfMatch } from "../workflow/if-match.js";
import { UUID, ZodPipe } from "../../shared/http/validatie.js";
import { StekkerbeheerService } from "./stekkerbeheer.service.js";

type Antwoord = { setHeader(naam: string, waarde: string): void };

// Stekkerbeheer (bouwplan §7.1): alleen de functioneel beheerder wijzigt; de auditor leest mee.
// De ETag is de laatste configuratieversie; bewerken vraagt die als If-Match.
@Controller("beheer/stekkers")
export class StekkerbeheerController {
  constructor(@Inject(StekkerbeheerService) private readonly beheer: StekkerbeheerService) {}

  @Get()
  @Roles("functioneel_beheerder", "auditor")
  lijst() {
    return this.beheer.lijst();
  }

  @Get(":id")
  @Roles("functioneel_beheerder", "auditor")
  async detail(@Param("id", UUID) id: string, @Res({ passthrough: true }) res: Antwoord) {
    const stekker = await this.beheer.detail(id);
    zetEtag(res, stekker.configuratie?.versie);
    return stekker;
  }

  @Post()
  @Roles("functioneel_beheerder")
  async aanmaken(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(stekkerSchema)) body: StekkerGevalideerd,
    @Res({ passthrough: true }) res: Antwoord
  ) {
    const stekker = await this.beheer.aanmaken(user, body);
    zetEtag(res, stekker.configuratie?.versie);
    return stekker;
  }

  @Put(":id")
  @Roles("functioneel_beheerder")
  async bewerken(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(stekkerSchema)) body: StekkerGevalideerd,
    @Res({ passthrough: true }) res: Antwoord
  ) {
    const stekker = await this.beheer.bewerken(user, id, leesIfMatch(ifMatch), body);
    zetEtag(res, stekker.configuratie?.versie);
    return stekker;
  }

  @Post(":id/deactiveren")
  @HttpCode(200)
  @Roles("functioneel_beheerder")
  deactiveren(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.beheer.zetActief(user, id, false);
  }

  @Post(":id/activeren")
  @HttpCode(200)
  @Roles("functioneel_beheerder")
  activeren(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.beheer.zetActief(user, id, true);
  }

  @Delete(":id")
  @HttpCode(204)
  @Roles("functioneel_beheerder")
  async verwijderen(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    await this.beheer.verwijderen(user, id);
  }
}

function zetEtag(res: Antwoord, versie: number | undefined) {
  if (versie !== undefined) {
    res.setHeader("ETag", etagVoorVersie(versie));
  }
}
