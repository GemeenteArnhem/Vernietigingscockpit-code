import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import type { TransitieActie } from "../workflow/transitions.js";
import { taakinstantieActies } from "../workflow/toegestane-acties.js";
import { WorkflowService } from "../workflow/workflow.service.js";
import { mapTaakinstantieMetActies, taakinstantieSelect } from "./taken.dto.js";
import type { BesluitRol } from "./taken-hulp.js";
import type { ApiTaakinstantie } from "@vernietigingscockpit/api-contract";

// Wie welke taak mag zien en wie een besluit mag nemen; plus het takenoverzicht en de
// taakdetails (voorheen direct in de controller).
@Injectable()
export class TaakToegangService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService,
    @Inject(WorkflowService) private readonly workflow: WorkflowService
  ) {}

  async getTaken(user: AuthUser, scope: "mijn" | "alle"): Promise<ApiTaakinstantie[]> {
    try {
      const medewerkerId = await this.currentMedewerker.findForUser(user);
      const where = await this.overzichtWhere(user, scope);
      const taken = await this.prisma.client.taakinstantie.findMany({
        where,
        select: taakinstantieSelect,
        orderBy: { stapSinds: "desc" },
      });

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
      throwDatabaseUnavailable(error);
      throw error;
    }
  }

  // Taakdetails met de versie (voor de ETag).
  async getTaak(user: AuthUser, taakinstantieId: string): Promise<{ versie: number; taak: ApiTaakinstantie }> {
    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const taak = await this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...(await this.overzichtWhere(user, user.roles.includes("auditor") ? "alle" : "mijn")),
      },
      select: taakinstantieSelect,
    });

    return {
      versie: taak.versie,
      taak: mapTaakinstantieMetActies(
        taak,
        taakinstantieActies(taak, {
          roles: user.roles,
          medewerkerId,
        })
      ),
    };
  }

  private async overzichtWhere(user: AuthUser, scope: "mijn" | "alle") {
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

  async toegangWhere(user: AuthUser) {
    if (user.roles.includes("auditor")) {
      return {};
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

  async taakVoorLijst(user: AuthUser, taakinstantieId: string) {
    const where = await this.toegangWhere(user);
    return this.prisma.client.taakinstantie.findFirstOrThrow({
      where: {
        id: taakinstantieId,
        ...where,
      },
      select: {
        id: true,
        naam: true,
        status: true,
        stapSinds: true,
        versie: true,
        recordmanager: {
          select: {
            id: true,
            naam: true,
            email: true,
          },
        },
        proceseigenaar: {
          select: {
            id: true,
            naam: true,
            email: true,
          },
        },
        archivaris: {
          select: {
            id: true,
            naam: true,
            email: true,
          },
        },
      },
    });
  }

  // Volgorde van controles bij een statuswijziging, zodat de foutcode zegt wat er mis is:
  // taak niet zichtbaar 404, niet de juiste persoon 403, verouderde versie 412,
  // verkeerde status 409. Domeinvalidaties (400) volgen in de transactie, en de
  // WorkflowService controleert status en versie daar nogmaals atomair.
  async taakVoorBesluit(
    user: AuthUser,
    taakinstantieId: string,
    rol: BesluitRol,
    actie: TransitieActie,
    verwachteVersie: number
  ) {
    const medewerkerId = await this.currentMedewerker.findForUser(user);

    if (!medewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const taak = await this.prisma.client.taakinstantie.findFirst({
      where: {
        id: taakinstantieId,
        OR: [
          { recordmanagerId: medewerkerId },
          { proceseigenaarId: medewerkerId },
          { archivarisId: medewerkerId },
        ],
      },
      select: {
        id: true,
        status: true,
        versie: true,
        recordmanagerId: true,
        proceseigenaarId: true,
        archivarisId: true,
      },
    });

    if (!taak) {
      throw new NotFoundException("Taak niet gevonden.");
    }

    const rolhouder = {
      recordmanager: taak.recordmanagerId,
      proceseigenaar: taak.proceseigenaarId,
      archivaris: taak.archivarisId,
    }[rol];

    if (rolhouder !== medewerkerId) {
      throw new ForbiddenException(`Alleen de ${rol} van deze taak kan deze actie uitvoeren.`);
    }

    this.workflow.controleerVooraf(taak, actie, verwachteVersie);

    return taak;
  }
}

function throwDatabaseUnavailable(error: unknown): never | void {
  if (!isDatabaseConnectionError(error)) {
    return;
  }

  throw new ServiceUnavailableException({
    code: "DATABASE_UNAVAILABLE",
    message:
      "De database is niet beschikbaar. Controleer DATABASE_URL, TLS-instellingen en IP-toegang.",
  });
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
