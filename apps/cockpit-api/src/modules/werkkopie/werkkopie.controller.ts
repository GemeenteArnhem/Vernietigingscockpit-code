import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import { werkkopieBewaartermijnSchema } from "@vernietigingscockpit/api-contract";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { UUID, ZodPipe } from "../../shared/http/validatie.js";
import { WerkkopieService } from "./werkkopie.service.js";

// Bewaartermijn van de werkkopie (ADR-0006 §2.4): de functioneel beheerder wijzigt, de
// auditor leest mee. Geen scherm (ui-spec ongewijzigd).
@Controller("beheer/instellingen/werkkopie-bewaartermijn")
export class WerkkopieInstellingController {
  constructor(@Inject(WerkkopieService) private readonly werkkopie: WerkkopieService) {}

  @Get()
  @Roles("functioneel_beheerder", "auditor")
  lees() {
    return this.werkkopie.getBewaartermijn();
  }

  @Put()
  @Roles("functioneel_beheerder")
  zet(@CurrentUser() user: AuthUser, @Body(new ZodPipe(werkkopieBewaartermijnSchema)) body: { waarde: string }) {
    return this.werkkopie.zetBewaartermijn(user, body.waarde);
  }
}

// Controle na het verwijderen van een werkkopie (ADR-0006 §6).
@Controller("dossiers")
export class DossiersController {
  constructor(@Inject(WerkkopieService) private readonly werkkopie: WerkkopieService) {}

  @Get("grafstenen/verificatie")
  @Roles("auditor", "functioneel_beheerder")
  verifieerGrafstenen() {
    return this.werkkopie.verifieerGrafstenen();
  }

  @Get(":id")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  dossier(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.werkkopie.getDossier(user, id);
  }
}
