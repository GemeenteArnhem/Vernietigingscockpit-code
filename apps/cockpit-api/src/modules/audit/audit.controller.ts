import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { AuditService } from "./audit.service.js";
import { auditlogQuerySchema } from "@vernietigingscockpit/api-contract";
import { UUID, ZodPipe } from "../../shared/http/validatie.js";

@Controller("taken/:id/auditlog")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getAuditlog(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Query(new ZodPipe(auditlogQuerySchema)) query: { pagina: number; perPagina: number }
  ) {
    return this.auditService.getAuditlog(user, id, query.pagina, query.perPagina);
  }

  @Get("verificatie")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  verifieer(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.auditService.verifieer(user, id);
  }
}
