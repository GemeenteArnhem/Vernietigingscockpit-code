import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthUser } from "../auth/auth-user.js";
import { etagVoorVersie, leesIfMatch } from "../workflow/if-match.js";
import type { StartSelectieInput } from "./taken-hulp.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { SelectieService } from "./selectie.service.js";
import { BeoordelingService } from "./beoordeling.service.js";
import { BesluitvormingService } from "./besluitvorming.service.js";
import { UitvoeringService } from "./uitvoering.service.js";
import { DossierService } from "./dossier.service.js";
import type { KandidatenQuery } from "./kandidaten-lijst.js";
import type { UpdateKandidaatBeoordelingInput } from "./beoordeling.dto.js";
import type { UpdateProceseigenaarAccorderingInput } from "./accordering.dto.js";
import { UUID, ZodPipe } from "../../shared/http/validatie.js";
import {
  accorderingBesluitSchema,
  bulkBeoordelingSchema,
  bulkBesluitSchema,
  kandidaatBeoordelingSchema,
  kandidaatIdsSchema,
  kandidatenQuerySchema,
  scopeSchema,
  startSelectieSchema,
} from "@vernietigingscockpit/api-contract";

@Controller("taken")
export class TakenController {
  constructor(
    @Inject(TaakToegangService) private readonly toegang: TaakToegangService,
    @Inject(SelectieService) private readonly selectie: SelectieService,
    @Inject(BeoordelingService) private readonly beoordeling: BeoordelingService,
    @Inject(BesluitvormingService) private readonly besluitvorming: BesluitvormingService,
    @Inject(UitvoeringService) private readonly uitvoering: UitvoeringService,
    @Inject(DossierService) private readonly dossier: DossierService
  ) {}

  @Get()
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getTaken(
    @CurrentUser() user: AuthUser,
    @Query("scope", new ZodPipe(scopeSchema)) scope: "mijn" | "alle"
  ) {
    return this.toegang.getTaken(user, scope);
  }

  @Get(":id")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  async getTaak(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Res({ passthrough: true }) res: { setHeader(naam: string, waarde: string): void }
  ) {
    const { versie, taak } = await this.toegang.getTaak(user, id);
    res.setHeader("ETag", etagVoorVersie(versie));
    return taak;
  }

  @Get(":id/selectie")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getSelectie(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.selectie.getSelectie(user, id);
  }

  // Kandidaten per pagina, met zoeken, filteren en sorteren op de server (CC-10).
  @Get(":id/kandidaten")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getKandidaten(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Query(new ZodPipe(kandidatenQuerySchema)) query: KandidatenQuery
  ) {
    return this.beoordeling.getKandidaten(user, id, query);
  }

  // Alle id's die aan de filters voldoen ("alles selecteren" over pagina's heen).
  @Get(":id/kandidaten/ids")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getKandidaatIds(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Query(new ZodPipe(kandidatenQuerySchema)) query: KandidatenQuery
  ) {
    return this.beoordeling.getKandidaatIds(user, id, query);
  }

  // Gedeelde waarden van een selectie, voor het detailpaneel bij bulkselectie.
  @Post(":id/kandidaten/samenvatting")
  @HttpCode(200)
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getKandidatenSamenvatting(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Body(new ZodPipe(kandidaatIdsSchema)) body: { ids: string[] }
  ) {
    return this.beoordeling.getKandidatenSamenvatting(user, id, body.ids);
  }

  // Bulkbeoordeling door de recordmanager: één verzoek voor de hele selectie.
  @Patch(":id/kandidaten")
  @Roles("recordmanager")
  bulkBeoordeling(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(bulkBeoordelingSchema)) body: UpdateKandidaatBeoordelingInput & { ids: string[] }
  ) {
    return this.beoordeling.bulkBeoordeling(user, id, leesIfMatch(ifMatch), body);
  }

  @Patch(":id/kandidaten/accordering/proceseigenaar")
  @Roles("proceseigenaar")
  bulkBesluitProceseigenaar(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(bulkBesluitSchema)) body: UpdateProceseigenaarAccorderingInput & { ids: string[] }
  ) {
    return this.besluitvorming.bulkBesluit(user, id, leesIfMatch(ifMatch), body, "proceseigenaar");
  }

  @Patch(":id/kandidaten/accordering/archivaris")
  @Roles("archivaris")
  bulkBesluitArchivaris(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(bulkBesluitSchema)) body: UpdateProceseigenaarAccorderingInput & { ids: string[] }
  ) {
    return this.besluitvorming.bulkBesluit(user, id, leesIfMatch(ifMatch), body, "archivaris");
  }

  @Get(":id/vernietigingsresultaten")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getVernietigingsresultaten(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string
  ) {
    return this.uitvoering.getVernietigingsresultaten(user, id);
  }

  @Get(":id/uitvoering")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getUitvoering(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.uitvoering.getUitvoering(user, id);
  }

  @Get(":id/verklaring")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getVerklaring(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.dossier.getVerklaring(user, id);
  }

  // Archiveren (CC-18): de recordmanager vraagt het aan; de worker voert het uit.
  @Post(":id/archiveren")
  @HttpCode(202)
  @Roles("recordmanager")
  archiveren(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined
  ) {
    return this.dossier.archiveren(user, id, leesIfMatch(ifMatch));
  }

  @Get(":id/archivering")
  @Roles("recordmanager", "proceseigenaar", "archivaris", "auditor")
  getArchivering(@CurrentUser() user: AuthUser, @Param("id", UUID) id: string) {
    return this.dossier.getArchivering(user, id);
  }

  // De verklaring maakt de worker bij de overgang naar resultaat (CC-17). Opnieuw maken
  // is een beheeractie (bijv. na een fout bij Gotenberg); er is geen knop in de UI.
  @Post(":id/verklaring/opnieuw")
  @HttpCode(202)
  @Roles("functioneel_beheerder")
  verklaringOpnieuw(@Param("id", UUID) id: string) {
    return this.dossier.verklaringOpnieuw(id);
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
    @Param("id", UUID) id: string
  ) {
    return new StreamableFile(await this.dossier.getVerklaringPdf(user, id));
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
    @Param("id", UUID) id: string
  ) {
    return this.dossier.getVerklaringBijlageCsv(user, id);
  }

  @Post(":id/selectie")
  @Roles("recordmanager")
  startSelectie(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Body(new ZodPipe(startSelectieSchema)) body: StartSelectieInput
  ) {
    return this.selectie.startSelectie(user, id, body);
  }

  @Patch(":id/kandidaten/:kandidaatId/beoordeling")
  @Roles("recordmanager")
  updateKandidaatBeoordeling(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Param("kandidaatId", UUID) kandidaatId: string,
    @Body(new ZodPipe(kandidaatBeoordelingSchema)) body: UpdateKandidaatBeoordelingInput
  ) {
    return this.beoordeling.updateKandidaatBeoordeling(
      user,
      id,
      kandidaatId,
      body
    );
  }

  @Post(":id/beoordeling/voorleggen")
  @Roles("recordmanager")
  beoordelingVoorleggen(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined
  ) {
    return this.beoordeling.beoordelingVoorleggen(user, id, leesIfMatch(ifMatch));
  }

  @Patch(":id/kandidaten/:kandidaatId/accordering/proceseigenaar")
  @Roles("proceseigenaar")
  updateProceseigenaarAccordering(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Param("kandidaatId", UUID) kandidaatId: string,
    @Body(new ZodPipe(accorderingBesluitSchema)) body: UpdateProceseigenaarAccorderingInput
  ) {
    return this.besluitvorming.updateProceseigenaarAccordering(
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
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined
  ) {
    return this.besluitvorming.proceseigenaarBesluiten(user, id, leesIfMatch(ifMatch));
  }

  @Patch(":id/kandidaten/:kandidaatId/accordering/archivaris")
  @Roles("archivaris")
  updateArchivarisAccordering(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Param("kandidaatId", UUID) kandidaatId: string,
    @Body(new ZodPipe(accorderingBesluitSchema)) body: UpdateProceseigenaarAccorderingInput
  ) {
    return this.besluitvorming.updateArchivarisAccordering(
      user,
      id,
      kandidaatId,
      body
    );
  }

  @Post(":id/accordering/archivaris/besluiten")
  @Roles("archivaris")
  archivarisBesluiten(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined
  ) {
    return this.besluitvorming.archivarisBesluiten(user, id, leesIfMatch(ifMatch));
  }

  @Post(":id/uitvoering/:stekkerId/opnieuw")
  @Roles("recordmanager")
  vernietigingOpnieuw(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Param("stekkerId", UUID) stekkerId: string
  ) {
    return this.uitvoering.vernietigingOpnieuw(user, id, stekkerId);
  }

  @Post(":id/vernietigingsopdracht")
  @Roles("recordmanager")
  vernietigingsopdracht(
    @CurrentUser() user: AuthUser,
    @Param("id", UUID) id: string,
    @Headers("if-match") ifMatch: string | undefined
  ) {
    return this.uitvoering.vernietigingsopdracht(user, id, leesIfMatch(ifMatch));
  }
}
