import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent, schrijfAuditEvents } from "../audit/audit-keten.js";
import { WorkflowService } from "../workflow/workflow.service.js";
import type { UpdateProceseigenaarAccorderingInput } from "./accordering.dto.js";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";
import { TaakToegangService } from "./taak-toegang.service.js";
import { berekenLijstHash, taakStatusAntwoord, telBeoordelingen, controleerFunctiescheiding, parseAccorderingBesluit, normalizeOptionalText, bulkKandidaten } from "./taken-hulp.js";
import type { ApiBijgewerkt, ApiKandidaatAccordering, ApiTaakStatus } from "@vernietigingscockpit/api-contract";

// Accordering door proceseigenaar en archivaris (CC-9): besluit per kandidaat en de stap afronden.
@Injectable()
export class BesluitvormingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(WorkflowService) private readonly workflow: WorkflowService,
    @Inject(TaakToegangService) private readonly toegang: TaakToegangService
  ) {}

  // Bulkbesluit van PO of archivaris (CC-10), met dezelfde regels als per kandidaat (CC-9).
  async bulkBesluit(
    user: AuthUser,
    taakinstantieId: string,
    verwachteVersie: number,
    input: UpdateProceseigenaarAccorderingInput & { ids: string[] },
    rol: "proceseigenaar" | "archivaris"
  ): Promise<ApiBijgewerkt> {
    const taak = await this.toegang.taakVoorBesluit(
      user,
      taakinstantieId,
      rol,
      rol === "proceseigenaar" ? "accordering_po.goedkeuren" : "accordering_archivaris.vrijgeven",
      verwachteVersie
    );
    const besluit = parseAccorderingBesluit(input.besluit);
    const toelichting = normalizeOptionalText(input.toelichting);
    const medewerkerId = rol === "proceseigenaar" ? taak.proceseigenaarId : taak.archivarisId;

    return this.prisma.client.$transaction(
      async (tx) => {
        const kandidaten = await bulkKandidaten(tx, taak.id, input.ids);
        const { ronde } = await tx.taakinstantie.findUniqueOrThrow({ where: { id: taak.id }, select: { ronde: true } });
        const ids = kandidaten.map((kandidaat) => kandidaat.id);

        await tx.kandidaatBesluit.createMany({
          data: ids.map((kandidaatId) => ({ kandidaatId, taakinstantieId: taak.id, ronde, rol, besluit, toelichting, medewerkerId })),
        });
        await tx.vernietigingskandidaat.updateMany({
          where: { id: { in: ids } },
          data: { ...(besluit === "RETOUR" ? { beoordeling: "RETOUR" } : {}), versie: { increment: 1 } },
        });
        await schrijfAuditEvents(
          tx,
          { type: "user", user, rol },
          kandidaten.map((kandidaat) => ({
            taakinstantieId: taak.id,
            actie: besluit === "RETOUR" ? "APPROVAL_REJECTED" : "APPROVAL_GRANTED",
            entiteitType: "vernietigingskandidaat",
            entiteitId: kandidaat.id,
            details: {
              besluit,
              vorigeBeoordeling: kandidaat.beoordeling,
              beoordeling: besluit === "RETOUR" ? "RETOUR" : kandidaat.beoordeling,
              toelichting,
              bulk: true,
            },
          }))
        );

        return { bijgewerkt: kandidaten.length };
      },
      { timeout: 120_000 }
    );
  }

  async updateProceseigenaarAccordering(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateProceseigenaarAccorderingInput
  ): Promise<ApiKandidaatAccordering> {
    return this.kandidaatBesluit(user, taakinstantieId, kandidaatId, input, "proceseigenaar");
  }

  async proceseigenaarBesluiten(user: AuthUser, taakinstantieId: string, verwachteVersie: number): Promise<ApiTaakStatus> {
    const taak = await this.toegang.taakVoorBesluit(user, taakinstantieId, "proceseigenaar", "accordering_po.goedkeuren", verwachteVersie);

    // Tweede verdediging naast de database-constraint: de indiener accordeert nooit zelf.
    controleerFunctiescheiding(taak.proceseigenaarId, [taak.recordmanagerId]);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const { totaal, retour } = await telBeoordelingen(tx, taak.id);

      if (totaal === 0) {
        throw new BadRequestException("Er zijn geen kandidaten om te accorderen.");
      }

      const actie = retour > 0 ? "accordering_po.terugsturen" : "accordering_po.goedkeuren";

      return this.workflow.transition(tx, {
        taakinstantieId: taak.id,
        actie,
        verwachteVersie,
        actor: { type: "user", user, rol: "proceseigenaar" },
        details: { totaal, retour },
      });
    });

    return taakStatusAntwoord(updated);
  }

  async updateArchivarisAccordering(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateProceseigenaarAccorderingInput
  ): Promise<ApiKandidaatAccordering> {
    return this.kandidaatBesluit(user, taakinstantieId, kandidaatId, input, "archivaris");
  }

  // Besluit van PO of archivaris over één kandidaat (CC-9). Het besluit en de toelichting
  // komen in kandidaat_besluit (append-only); de toelichting van de recordmanager op de
  // kandidaat blijft staan. RETOUR zet de kandidaat terug voor de recordmanager.
  private async kandidaatBesluit(
    user: AuthUser,
    taakinstantieId: string,
    kandidaatId: string,
    input: UpdateProceseigenaarAccorderingInput,
    rol: "proceseigenaar" | "archivaris"
  ) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const besluit = parseAccorderingBesluit(input.besluit);
    const toelichting = normalizeOptionalText(input.toelichting);
    const kandidaat = await this.prisma.client.vernietigingskandidaat.findFirst({
      where: {
        id: kandidaatId,
        selectie: {
          taakinstantieId,
          ...ACTIEVE_SELECTIE,
          taakinstantie:
            rol === "proceseigenaar"
              ? { proceseigenaarId: currentMedewerkerId, status: "accordering_po" }
              : { archivarisId: currentMedewerkerId, status: "accordering_archivaris" },
        },
      },
      select: {
        id: true,
        beoordeling: true,
        selectie: { select: { taakinstantie: { select: { ronde: true } } } },
      },
    });

    if (!kandidaat) {
      throw new BadRequestException(
        `Deze kandidaat kan niet door de ${rol} worden geaccordeerd vanuit de huidige taakstatus.`
      );
    }

    return this.prisma.client.$transaction(async (tx) => {
      await tx.kandidaatBesluit.create({
        data: {
          kandidaatId: kandidaat.id,
          taakinstantieId,
          ronde: kandidaat.selectie.taakinstantie.ronde,
          rol,
          besluit,
          toelichting,
          medewerkerId: currentMedewerkerId,
        },
      });

      const result = await tx.vernietigingskandidaat.update({
        where: { id: kandidaat.id },
        data: {
          ...(besluit === "RETOUR" ? { beoordeling: "RETOUR" } : {}),
          versie: { increment: 1 },
        },
        select: { id: true, beoordeling: true, versie: true },
      });

      await schrijfAuditEvent(tx, { type: "user", user, rol }, {
        taakinstantieId,
        actie: besluit === "RETOUR" ? "APPROVAL_REJECTED" : "APPROVAL_GRANTED",
        entiteitType: "vernietigingskandidaat",
        entiteitId: kandidaat.id,
        details: {
          besluit,
          vorigeBeoordeling: kandidaat.beoordeling,
          beoordeling: result.beoordeling,
          toelichting,
        },
      });

      // Zelfde antwoord als voorheen: de toelichting is die van dit besluit.
      return { ...result, toelichting };
    });
  }

  async archivarisBesluiten(user: AuthUser, taakinstantieId: string, verwachteVersie: number): Promise<ApiTaakStatus> {
    const taak = await this.toegang.taakVoorBesluit(user, taakinstantieId, "archivaris", "accordering_archivaris.vrijgeven", verwachteVersie);

    // Tweede verdediging naast de database-constraint: de archivaris is niet de
    // indiener en niet de accorderende proceseigenaar.
    controleerFunctiescheiding(taak.archivarisId, [taak.recordmanagerId, taak.proceseigenaarId]);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const { totaal, retour } = await telBeoordelingen(tx, taak.id);

      if (totaal === 0) {
        throw new BadRequestException("Er zijn geen kandidaten om te accorderen.");
      }

      const actie = retour > 0 ? "accordering_archivaris.terugsturen" : "accordering_archivaris.vrijgeven";
      // Bij vrijgave de vingerafdruk van de lijst vastleggen; de vernietigingsopdracht
      // controleert dat de lijst daarna niet meer is veranderd (CC-9).
      const lijstHash = actie === "accordering_archivaris.vrijgeven" ? await berekenLijstHash(tx, taak.id) : null;

      return this.workflow.transition(tx, {
        taakinstantieId: taak.id,
        actie,
        verwachteVersie,
        actor: { type: "user", user, rol: "archivaris" },
        details: { totaal, retour, ...(lijstHash ? { lijstHash } : {}) },
        ...(lijstHash ? { extraData: { lijstHash } } : {}),
      });
    });

    return taakStatusAntwoord(updated);
  }
}
