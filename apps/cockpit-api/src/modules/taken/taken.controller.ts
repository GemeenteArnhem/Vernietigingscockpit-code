import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  StreamableFile,
} from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { mapTaakinstantieMetActies, taakinstantieSelect } from "./taken.dto.js";
import { taakinstantieActies } from "../workflow/toegestane-acties.js";
import type { StartSelectieInput } from "./taken.service.js";
import { TakenService } from "./taken.service.js";
import type { UpdateKandidaatBeoordelingInput } from "./beoordeling.dto.js";
import type { UpdateProceseigenaarAccorderingInput } from "./accordering.dto.js";

@Controller("taken")
export class TakenController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService)
    private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(TakenService) private readonly takenService: TakenService
  ) {}

  @Get()
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  async getTaken(
    @CurrentUser() user: AuthUser,
    @Query("scope") scope: "mijn" | "alle" = "mijn"
  ) {
    try {
      const medewerkerId = await this.currentMedewerker.findForUser(user);
      const where = await this.buildAccessWhere(user, scope);
      const taken = await this.getTakenForDashboard(where);

      return taken.map((taak) =>
        mapTaakinstantieMetActies(
          taak,
          taakinstantieActies(taak, {
            roles: user.roles,
            medewerkerId,
          })
        )
      );
    } catch (error) {
      this.throwDatabaseUnavailable(error);
      throw error;
    }
  }

  @Get(":id")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  async getTaak(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id,
        ...(await this.buildDetailAccessWhere(user)),
      },
      select: taakinstantieSelect,
    });

    return mapTaakinstantieMetActies(
      taak,
      taakinstantieActies(taak, {
        roles: user.roles,
        medewerkerId,
      })
    );
  }

  @Get(":id/selectie")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getSelectie(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.getSelectie(user, id);
  }

  @Get(":id/kandidaten")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getKandidaten(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.getKandidaten(user, id);
  }

  @Get(":id/vernietigingsresultaten")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getVernietigingsresultaten(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.takenService.getVernietigingsresultaten(user, id);
  }

  @Get(":id/uitvoering")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getUitvoering(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.getUitvoering(user, id);
  }

  @Get(":id/verklaring")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getVerklaring(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.getVerklaring(user, id);
  }

  @Post(":id/verklaring/genereren")
  @Roles("recordmanager")
  genereerVerklaring(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.genereerVerklaring(user, id);
  }

  @Get(":id/verklaring.pdf")
  @Header("Content-Type", "application/pdf")
  @Header(
    "Content-Disposition",
    'attachment; filename="vernietigingsverklaring.pdf"'
  )
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  async getVerklaringPdf(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return new StreamableFile(await this.takenService.getVerklaringPdf(user, id));
  }

  @Get(":id/verklaring/bijlage.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="vernietigingsresultaten.csv"'
  )
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getVerklaringBijlageCsv(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.takenService.getVerklaringBijlageCsv(user, id);
  }

  @Post(":id/selectie")
  @Roles("recordmanager")
  startSelectie(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: StartSelectieInput
  ) {
    return this.takenService.startSelectie(user, id, body);
  }

  @Patch(":id/kandidaten/:kandidaatId/beoordeling")
  @Roles("recordmanager")
  updateKandidaatBeoordeling(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("kandidaatId") kandidaatId: string,
    @Body() body: UpdateKandidaatBeoordelingInput
  ) {
    return this.takenService.updateKandidaatBeoordeling(
      user,
      id,
      kandidaatId,
      body
    );
  }

  @Post(":id/beoordeling/voorleggen")
  @Roles("recordmanager")
  beoordelingVoorleggen(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.beoordelingVoorleggen(user, id);
  }

  @Patch(":id/kandidaten/:kandidaatId/accordering/proceseigenaar")
  @Roles("proceseigenaar")
  updateProceseigenaarAccordering(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("kandidaatId") kandidaatId: string,
    @Body() body: UpdateProceseigenaarAccorderingInput
  ) {
    return this.takenService.updateProceseigenaarAccordering(
      user,
      id,
      kandidaatId,
      body
    );
  }

  @Post(":id/accordering/proceseigenaar/besluiten")
  @Roles("proceseigenaar")
  proceseigenaarBesluiten(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.takenService.proceseigenaarBesluiten(user, id);
  }

  @Patch(":id/kandidaten/:kandidaatId/accordering/archivaris")
  @Roles("archivaris")
  updateArchivarisAccordering(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("kandidaatId") kandidaatId: string,
    @Body() body: UpdateProceseigenaarAccorderingInput
  ) {
    return this.takenService.updateArchivarisAccordering(
      user,
      id,
      kandidaatId,
      body
    );
  }

  @Post(":id/accordering/archivaris/besluiten")
  @Roles("archivaris")
  archivarisBesluiten(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.takenService.archivarisBesluiten(user, id);
  }

  @Post(":id/vernietigingsopdracht")
  @Roles("recordmanager")
  vernietigingsopdracht(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string
  ) {
    return this.takenService.vernietigingsopdracht(user, id);
  }

  private async buildAccessWhere(user: AuthUser, scope: "mijn" | "alle") {
    if (scope === "alle" && user.roles.includes("auditor")) {
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
    return this.buildAccessWhere(
      user,
      user.roles.includes("auditor") ? "alle" : "mijn"
    );
  }

  private async getTakenForDashboard(
    where: Awaited<ReturnType<TakenController["buildAccessWhere"]>>
  ) {
    try {
      return await this.prisma.client.taakinstantie.findMany({
        where,
        select: taakinstantieSelect,
        orderBy: { stapSinds: "desc" },
      });
    } catch (error) {
      this.throwDatabaseUnavailable(error);
      throw error;
    }
  }

  private throwDatabaseUnavailable(error: unknown): never | void {
    if (!isDatabaseConnectionError(error)) {
      return;
    }

    throw new ServiceUnavailableException({
      code: "DATABASE_UNAVAILABLE",
      message:
        "De database is niet beschikbaar. Controleer DATABASE_URL, TLS-instellingen en IP-toegang.",
    });
  }
}

function isDatabaseConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes(
      "Client network socket disconnected before secure TLS connection was established"
    ) ||
    error.message.includes("Can't reach database server") ||
    error.message.includes("Connection terminated") ||
    error.message.includes("ECONNRESET")
  );
}
