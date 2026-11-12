import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent } from "../audit/audit-keten.js";
import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";
import { verwijderBezwaar } from "./opmerkingen.js";
import type { BesluitRol } from "./taken-hulp.js";

// Een eigen opmerking logisch verwijderen (besluit 2026-11-12). Volgorde van controles:
// opmerking niet zichtbaar of niet van de gebruiker 404, verkeerde stap of de toelichting bij
// de huidige uitsluiting 409. De opmerking verdwijnt voor iedereen; het auditlog houdt het vast.
@Injectable()
export class OpmerkingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService
  ) {}

  async verwijder(user: AuthUser, taakinstantieId: string, kandidaatId: string, opmerkingId: string): Promise<void> {
    const medewerkerId = await this.currentMedewerker.findForUser(user);

    if (!medewerkerId) {
      throw new ForbiddenException("De ingelogde gebruiker is niet gekoppeld aan een medewerker.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      const opmerking = await tx.kandidaatOpmerking.findFirst({
        where: {
          id: opmerkingId,
          kandidaatId,
          taakinstantieId,
          medewerkerId,
          verwijderdOp: null,
          kandidaat: { selectie: { ...ACTIEVE_SELECTIE } },
          taakinstantie: { verwijderdOp: null },
        },
        include: {
          kandidaat: { select: { beoordeling: true, beoordeeldOp: true } },
          taakinstantie: { select: { status: true, ronde: true } },
        },
      });

      if (!opmerking) {
        throw new NotFoundException("Opmerking niet gevonden.");
      }

      const bezwaar = verwijderBezwaar(opmerking, opmerking.kandidaat, opmerking.taakinstantie);

      if (bezwaar === "andere_stap") {
        throw new ConflictException("Een opmerking kan alleen worden verwijderd in de stap waarin hij is gemaakt.");
      }
      if (bezwaar === "uitsluiting") {
        throw new ConflictException("De toelichting bij de uitsluiting kan niet worden verwijderd.");
      }

      // Voorwaardelijk bijwerken, zodat twee gelijktijdige verzoeken niet allebei slagen.
      const { count } = await tx.kandidaatOpmerking.updateMany({
        where: { id: opmerking.id, verwijderdOp: null },
        data: { verwijderdOp: new Date(), verwijderdDoor: medewerkerId },
      });

      if (count === 0) {
        throw new NotFoundException("Opmerking niet gevonden.");
      }

      await schrijfAuditEvent(tx, { type: "user", user, rol: opmerking.rol as BesluitRol }, {
        taakinstantieId,
        eventType: "Opmerking verwijderd",
        entiteitType: "vernietigingskandidaat",
        entiteitId: kandidaatId,
        details: { opmerkingId: opmerking.id, rol: opmerking.rol, ronde: opmerking.ronde },
      });
    });
  }
}
