import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../shared/db/prisma.service.js";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { controleerKeten, type KetenFout } from "./audit-keten.js";

const MAX_PER_PAGINA = 200;
const VERIFICATIE_BLOK = 1000;

// Lezen en controleren van het auditlog van een taak. Schrijven gaat via audit-keten.ts.
// Toegang: de recordmanager, proceseigenaar en archivaris van de taak, en elke auditor.
// Anderen krijgen 404 (de taak bestaat voor hen niet).
@Injectable()
export class AuditService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService
  ) {}

  async getAuditlog(user: AuthUser, taakinstantieId: string, pagina = 1, perPagina = 50) {
    if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(perPagina) || perPagina < 1) {
      throw new BadRequestException("pagina en perPagina moeten positieve gehele getallen zijn.");
    }

    const grootte = Math.min(perPagina, MAX_PER_PAGINA);
    await this.controleerToegang(user, taakinstantieId);

    const [totaal, events] = await this.prisma.client.$transaction([
      this.prisma.client.auditEvent.count({ where: { taakinstantieId } }),
      this.prisma.client.auditEvent.findMany({
        where: { taakinstantieId },
        orderBy: { id: "asc" },
        skip: (pagina - 1) * grootte,
        take: grootte,
      }),
    ]);

    return {
      pagina,
      perPagina: grootte,
      totaal,
      items: events.map((event) => ({
        id: event.id.toString(),
        tijdstip: event.tijdstip.toISOString(),
        actor: { type: event.actorType, id: event.actorId, naam: event.actorNaam },
        rol: event.rol,
        eventType: event.eventType,
        eventTypeBegrippenlijst: event.eventTypeBegrippenlijst,
        entiteit: { type: event.entiteitType, id: event.entiteitId },
        details: event.details,
        correlatieId: event.correlatieId,
        hash: event.hash,
      })),
    };
  }

  // Loopt de hele keten van de taak na, in blokken, zonder alles tegelijk te laden.
  async verifieer(user: AuthUser, taakinstantieId: string) {
    await this.controleerToegang(user, taakinstantieId);
    return verifieerTaakKeten(this.prisma, taakinstantieId);
  }

  private async controleerToegang(user: AuthUser, taakinstantieId: string) {
    if (user.roles.includes("auditor")) {
      const bestaat = await this.prisma.client.taakinstantie.count({ where: { id: taakinstantieId } });
      if (bestaat === 0) {
        throw new NotFoundException("Taak niet gevonden.");
      }
      return;
    }

    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const betrokken = medewerkerId
      ? await this.prisma.client.taakinstantie.count({
          where: {
            id: taakinstantieId,
            OR: [
              { recordmanagerId: medewerkerId },
              { proceseigenaarId: medewerkerId },
              { archivarisId: medewerkerId },
            ],
          },
        })
      : 0;

    if (betrokken === 0) {
      throw new NotFoundException("Taak niet gevonden.");
    }
  }
}

// Controle van de auditketen van één taak, ook bruikbaar zonder gebruiker (worker,
// vernietigingsverklaring).
export async function verifieerTaakKeten(prisma: PrismaService, taakinstantieId: string) {
  const fouten: KetenFout[] = [];
  let aantal = 0;
  let vorigeHash: string | null = null;
  let vanafId: bigint | undefined;

  for (;;) {
    const blok = await prisma.client.auditEvent.findMany({
      where: { taakinstantieId, ...(vanafId !== undefined ? { id: { gt: vanafId } } : {}) },
      orderBy: { id: "asc" },
      take: VERIFICATIE_BLOK,
    });

    if (blok.length === 0) {
      break;
    }

    const uitkomst = controleerKeten(blok, vorigeHash);
    fouten.push(...uitkomst.fouten);
    vorigeHash = uitkomst.laatsteHash;
    vanafId = blok[blok.length - 1].id;
    aantal += blok.length;
  }

  return {
    taakinstantieId,
    intact: fouten.length === 0,
    aantalEvents: aantal,
    laatsteHash: vorigeHash,
    // Begrensd: bij een kapotte keten volstaan de eerste afwijkingen.
    fouten: fouten.slice(0, 50),
  };
}
