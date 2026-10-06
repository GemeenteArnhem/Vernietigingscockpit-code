import { Controller, Get, Inject } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { AnyAuthenticated } from "../auth/roles.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import { MeService } from "./me.service.js";

@Controller("me")
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  @AnyAuthenticated()
  getMe(@CurrentUser() user: AuthUser) {
    return this.meService.getMe(user);
  }
}
