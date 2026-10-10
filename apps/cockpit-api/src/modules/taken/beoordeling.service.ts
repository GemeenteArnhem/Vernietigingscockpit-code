import { UITSLUITREDEN_WAARDERING } from "@vernietigingscockpit/api-contract";
import { mdtoVelden } from "./kandidaat-weergave.js";
import { leesArchiefvormer } from "../taakdefinities/archiefvormer.js";
import { BadRequestException, ForbiddenException, Inject, Injectable, ConflictException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent, schrijfAuditEvents } from "../audit/audit-keten.js";
import { WorkflowService } from "../workflow/workflow.service.js";
import type { UpdateKandidaatBeoordelingInput } from "./beoordeling.dto.js";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";
import { facetten, kandidatenOrderBy, kandidatenWhere, samenvatting, volgnummers, type KandidatenQuery } from "./kandidaten-lijst.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { STANDAARD_KANDIDATEN_QUERY, zichtbareToelichting, taakStatusAntwoord, telBeoordelingen, parseKandidaatBeoordeling, normalizeOptionalText, bulkKandidaten } from "./taken-hulp.js";
import type { ApiBijgewerkt, ApiKandidaatBeoordeling, ApiKandidaatIds, ApiKandidatenPagina, ApiSelectieSamenvatting, ApiTaakStatus } from "@vernietigingscockpit/api-contract";

// Beoordeling door de recordmanager (CC-10): kandidatenlijst, per kandidaat en in bulk, en voorleggen.
@Injectable()
export class BeoordelingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(WorkflowService) private readonly workflow: WorkflowService,
    @Inject(TaakToegangService) private readonly toegang: TaakToegangService
  ) {}

  // Eén pagina van de kandidatenlijst (CC-10), met de tellingen en filterkeuzes over de
  // hele lijst. Zonder parameters: de eerste 500 in de vaste volgorde.
  async getKandidaten(user: AuthUser, taakinstantieId: string, query: KandidatenQuery = STANDAARD_KANDIDATEN_QUERY): Promise<ApiKandidatenPagina> {
    const taak = await this.toegang.taakVoorLijst(user, taakinstantieId);
    const where = kandidatenWhere(taak.id, query);
    const [totaal, kandidaten, tellingen, keuzes] = await Promise.all([
      this.prisma.client.vernietigingskandidaat.count({ where }),
      this.prisma.client.vernietigingskandidaat.findMany({
        where,
        include: {
          besluiten: { orderBy: { tijdstip: "desc" }, take: 1 },
          selectie: {
            include: {
              stekkerConfiguratie: {
                include: {
                  stekker: true,
                },
              },
            },
          },
        },
        orderBy: kandidatenOrderBy(query.sort, query.richting),
        skip: query.offset,
        take: query.limit,
      }),
      telBeoordelingen(this.prisma.client, taak.id),
      facetten(this.prisma.client, taak.id),
    ]);
    const nummers = await volgnummers(this.prisma.client, taak.id, kandidaten.map((kandidaat) => kandidaat.id));

    return {
      taak: {
        id: taak.id,
        naam: taak.naam,
        status: taak.status,
        stapSinds: taak.stapSinds.toISOString(),
        versie: taak.versie,
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
        archiefvormer: leesArchiefvormer(taak.archiefvormer),
      },
      pagina: { offset: query.offset, limit: query.limit, totaal },
      tellingen,
      facetten: keuzes,
      kandidaten: kandidaten.map((kandidaat) => ({
        volgnummer: nummers.get(kandidaat.id) ?? 0,
        id: kandidaat.id,
        ...mdtoVelden(kandidaat),
        beoordeling: kandidaat.beoordeling,
        uitsluitReden: kandidaat.uitsluitReden,
        // Wat de schermen tonen, is ongewijzigd: de toelichting van wie het laatst
        // besliste (RM-beoordeling of besluit van PO/archivaris). De RM-toelichting zelf
        // blijft bewaard en staat apart in toelichtingRecordmanager (CC-9).
        toelichting: zichtbareToelichting(kandidaat),
        toelichtingRecordmanager: kandidaat.toelichting,
        laatsteBesluit: kandidaat.besluiten[0]
          ? {
              rol: kandidaat.besluiten[0].rol,
              besluit: kandidaat.besluiten[0].besluit,
              toelichting: kandidaat.besluiten[0].toelichting,
              ronde: kandidaat.besluiten[0].ronde,
              tijdstip: kandidaat.besluiten[0].tijdstip.toISOString(),
            }
          : null,
        stekker: {
          id: kandidaat.selectie.stekkerConfiguratie.stekker.id,
          naam: kandidaat.selectie.stekkerConfiguratie.stekker.naam,
        },
      })),
    };
  }

  // Alle kandidaat-id's die aan de filters voldoen, voor "alles selecteren" over pagina's.
  async getKandidaatIds(user: AuthUser, taakinstantieId: string, query: KandidatenQuery): Promise<ApiKandidaatIds> {
    const taak = await this.toegang.taakVoorLijst(user, taakinstantieId);
    const rijen = await this.prisma.client.vernietigingskandidaat.findMany({
      where: kandidatenWhere(taak.id, query),
      select: { id: true },
      orderBy: kandidatenOrderBy(query.sort, query.richting),
    });

    return { ids: rijen.map((rij) => rij.id) };
  }

  // Gedeelde waarden van een selectie, voor het detailpaneel bij bulkselectie.
  async getKandidatenSamenvatting(user: AuthUser, taakinstantieId: string, ids: string[]): Promise<ApiSelectieSamenvatting> {
    const taak = await this.toegang.taakVoorLijst(user, taakinstantieId);
    const rijen = await this.prisma.client.vernietigingskandidaat.findMany({
      where: kandidatenWhere(taak.id, { ids, zoekIn: "all" }),
      select: {
        id: true,
        classificatieBegripCode: true,
        selectielijst: true,
        informatiecategorieBegripLabel: true,
        termijnLooptijd: true,
        dekkingInTijdBegindatum: true,
        dekkingInTijdEinddatum: true,
        termijnEinddatum: true,
        aggregatieniveau: true,
        waarderingBegripLabel: true,
        beoordeling: true,
        aantalObjecten: true,
        aantalBetrokkenen: true,
        selectie: { select: { stekkerConfiguratie: { select: { stekker: { select: { naam: true } } } } } },
      },
    });
    const nummers = await volgnummers(this.prisma.client, taak.id, rijen.map((rij) => rij.id));

    return samenvatting(
      rijen.map((rij) => ({
        ...rij,
        stekker: rij.selectie.stekkerConfiguratie.stekker.naam,
        volgnummer: nummers.get(rij.id) ?? 0,
      }))
    );
  }

  // Bulkbeoordeling door de recordmanager (CC-10): één verzoek en één transactie voor de
  // hele selectie, met per kandidaat een audit-event (in één batch).
  async bulkBeoordeling(
    user: AuthUser,
    taakinstantieId: string,
    verwachteVersie: number,
    input: UpdateKandidaatBeoordelingInput & { ids: string[] }
  ): Promise<ApiBijgewerkt> {
    const taak = await this.toegang.taakVoorBesluit(user, taakinstantieId, "recordmanager", "beoordeling.voorleggen", verwachteVersie);
    const beoordeling = parseKandidaatBeoordeling(input.beoordeling);
    const toelichting = normalizeOptionalText(input.toelichting);
    const uitsluitReden = beoordeling === "UITGESLOTEN" ? normalizeOptionalText(input.uitsluitReden) : null;

    return this.prisma.client.$transaction(
      async (tx) => {
        const kandidaten = await bulkKandidaten(tx, taak.id, input.ids);
        weigerVastUitgesloten(kandidaten);
        await tx.vernietigingskandidaat.updateMany({
          where: { id: { in: kandidaten.map((kandidaat) => kandidaat.id) } },
          data: {
            beoordeling,
            uitsluitReden,
            toelichting,
            beoordeeldDoor: taak.recordmanagerId,
            beoordeeldOp: new Date(),
            versie: { increment: 1 },
          },
        });
        await schrijfAuditEvents(
          tx,
          { type: "user", user, rol: "recordmanager" },
          kandidaten.map((kandidaat) => ({
            taakinstantieId: taak.id,
            eventType: beoordeling === "UITGESLOTEN" ? "Kandidaat uitgesloten" : "Kandidaat opgenomen",
            entiteitType: "vernietigingskandidaat",
            entiteitId: kandidaat.id,
            details: { vorigeBeoordeling: kandidaat.beoordeling, beoordeling, uitsluitReden, toelichting, bulk: true },
          }))
        );

        return { bijgewerkt: kandidaten.length };
      },
      { timeout: 120_000 }
    );
  }

  async updateKandidaatBeoordeling(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateKandidaatBeoordelingInput
  ): Promise<ApiKandidaatBeoordeling> {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const beoordeling = parseKandidaatBeoordeling(input.beoordeling);
    const toelichting = normalizeOptionalText(input.toelichting);
    const uitsluitReden = beoordeling === "UITGESLOTEN" ? normalizeOptionalText(input.uitsluitReden) : null;

    const kandidaat = await this.prisma.client.vernietigingskandidaat.findFirst({
      where: {
        id: kandidaatId,
        selectie: {
          taakinstantieId,
          ...ACTIEVE_SELECTIE,
          taakinstantie: {
            recordmanagerId: currentMedewerkerId,
            status: "beoordeling",
          },
        },
      },
      select: {
        id: true,
        beoordeling: true,
        uitsluitReden: true,
        selectie: {
          select: {
            taakinstantieId: true,
          },
        },
      },
    });

    if (!kandidaat) {
      throw new BadRequestException(
        "Deze kandidaat kan niet worden beoordeeld vanuit de huidige taakstatus."
      );
    }

    weigerVastUitgesloten([kandidaat]);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.vernietigingskandidaat.update({
        where: {
          id: kandidaat.id,
        },
        data: {
          beoordeling,
          uitsluitReden,
          toelichting,
          beoordeeldDoor: currentMedewerkerId,
          beoordeeldOp: new Date(),
          versie: {
            increment: 1,
          },
        },
        select: {
          id: true,
          beoordeling: true,
          uitsluitReden: true,
          toelichting: true,
          versie: true,
        },
      });

      await schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
        taakinstantieId,
        eventType: beoordeling === "UITGESLOTEN" ? "Kandidaat uitgesloten" : "Kandidaat opgenomen",
        entiteitType: "vernietigingskandidaat",
        entiteitId: kandidaat.id,
        details: {
          vorigeBeoordeling: kandidaat.beoordeling,
          beoordeling,
          uitsluitReden,
          toelichting,
        },
      });

      return result;
    });

    return updated;
  }

  async beoordelingVoorleggen(user: AuthUser, taakinstantieId: string, verwachteVersie: number): Promise<ApiTaakStatus> {
    const taak = await this.toegang.taakVoorBesluit(user, taakinstantieId, "recordmanager", "beoordeling.voorleggen", verwachteVersie);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const tellingen = await telBeoordelingen(tx, taak.id);

      if (tellingen.totaal === 0) {
        throw new BadRequestException("Er zijn geen kandidaten om voor te leggen.");
      }

      if (tellingen.opgenomen > 0) {
        throw new BadRequestException(
          `Nog niet alle kandidaten zijn beoordeeld. Openstaand: ${tellingen.opgenomen}.`
        );
      }

      return this.workflow.transition(tx, {
        taakinstantieId: taak.id,
        actie: "beoordeling.voorleggen",
        verwachteVersie,
        actor: { type: "user", user, rol: "recordmanager" },
        details: {
          totaal: tellingen.totaal,
          akkoord: tellingen.akkoord,
          uitgesloten: tellingen.uitgesloten,
          retour: tellingen.retour,
        },
      });
    });

    return taakStatusAntwoord(updated);
  }
}

// Een kandidaat met een waardering anders dan V heeft het systeem bij import uitgesloten
// (ADR-0005, B-M1). Die beslissing ligt vast: de recordmanager kan hem niet opnemen of wijzigen.
function weigerVastUitgesloten(kandidaten: Array<{ uitsluitReden: string | null }>) {
  const vast = kandidaten.filter((kandidaat) => kandidaat.uitsluitReden === UITSLUITREDEN_WAARDERING).length;

  if (vast > 0) {
    throw new ConflictException(
      `${vast} kandidaat/kandidaten zijn automatisch uitgesloten (${UITSLUITREDEN_WAARDERING}) en kunnen niet worden gewijzigd.`
    );
  }
}
