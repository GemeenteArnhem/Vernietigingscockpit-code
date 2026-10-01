import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import {
  mapTaakdefinitie,
  taakdefinitieSelect,
} from "./taakdefinities.dto.js";
import {
  mapTaakinstantie,
  taakinstantieSelect,
} from "../taken/taken.dto.js";

type TaakdefinitieStekkerInput = {
  stekkerId: string;
  selectieparameters?: Record<string, unknown>;
};

export type CreateTaakdefinitieInput = {
  naam?: string;
  omschrijving?: string;
  categorie?: string;
  frequentie?: "jaarlijks" | "kwartaal" | "maandelijks" | "ad_hoc";
  startmaand?: number | null;
  recordmanagerId?: string;
  proceseigenaarId?: string;
  archivarisId?: string;
  stekkers?: TaakdefinitieStekkerInput[];
};

export type CreateTaakinstantieInput = {
  naam?: string;
  peildatum?: string | null;
};

@Injectable()
export class TaakdefinitiesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService)
    private readonly currentMedewerker: CurrentMedewerkerService
  ) {}

  async createTaakdefinitie(user: AuthUser, input: CreateTaakdefinitieInput) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const data = this.validateCreateInput(input);

    if (data.recordmanagerId !== currentMedewerkerId) {
      throw new ForbiddenException(
        "Een recordmanager kan alleen taakdefinities voor zichzelf aanmaken."
      );
    }

    await this.validateMedewerkers(data);
    await this.validateStekkers(data.stekkers);

    const taakdefinitie = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.taakdefinitie.create({
        data: {
          naam: data.naam,
          omschrijving: data.omschrijving,
          categorie: data.categorie,
          frequentie: data.frequentie,
          startmaand: data.startmaand,
          recordmanagerId: data.recordmanagerId,
          proceseigenaarId: data.proceseigenaarId,
          archivarisId: data.archivarisId,
          stekkers:
            data.stekkers.length > 0
              ? {
                  create: data.stekkers.map((stekker) => ({
                    stekker: {
                      connect: { id: stekker.stekkerId },
                    },
                    selectieparameters:
                      stekker.selectieparameters as Prisma.InputJsonValue,
                  })),
                }
              : undefined,
        },
        select: { id: true },
      });

      await this.createConfiguratieEvent(tx, user, {
        entiteitType: "taakdefinitie",
        entiteitId: created.id,
        actie: "TAAKDEFINITIE_AANGEMAAKT",
        details: {
          naam: data.naam,
          categorie: data.categorie,
          frequentie: data.frequentie,
          stekkers: data.stekkers.map((stekker) => stekker.stekkerId),
        },
      });

      return tx.taakdefinitie.findUniqueOrThrow({
        where: { id: created.id },
        select: taakdefinitieSelect,
      });
    });

    return mapTaakdefinitie(taakdefinitie);
  }

  async createTaakinstantie(
    user: AuthUser,
    taakdefinitieId: string,
    input: CreateTaakinstantieInput
  ) {
    const currentMedewerkerId = await this.currentMedewerker.findForUser(user);

    if (!currentMedewerkerId) {
      throw new ForbiddenException(
        "De ingelogde gebruiker is niet gekoppeld aan een medewerker."
      );
    }

    const definition = await this.prisma.client.taakdefinitie.findFirstOrThrow({
      where: {
        id: taakdefinitieId,
        recordmanagerId: currentMedewerkerId,
        actief: true,
      },
      select: {
        id: true,
        naam: true,
        recordmanagerId: true,
        proceseigenaarId: true,
        archivarisId: true,
      },
    });
    const peildatum = parseOptionalDate(input.peildatum, "peildatum");
    const naam = input.naam?.trim() || definition.naam;

    const taak = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.taakinstantie.create({
        data: {
          taakdefinitieId: definition.id,
          naam,
          status: "init",
          peildatum,
          recordmanagerId: definition.recordmanagerId,
          proceseigenaarId: definition.proceseigenaarId,
          archivarisId: definition.archivarisId,
        },
        select: { id: true },
      });

      await this.createConfiguratieEvent(tx, user, {
        entiteitType: "taakinstantie",
        entiteitId: created.id,
        actie: "TAAK_INSTANTIE_AANGEMAAKT",
        details: {
          taakdefinitieId: definition.id,
          naam,
          peildatum: peildatum?.toISOString() ?? null,
        },
      });

      return tx.taakinstantie.findUniqueOrThrow({
        where: { id: created.id },
        select: taakinstantieSelect,
      });
    });

    return mapTaakinstantie(taak);
  }

  private validateCreateInput(input: CreateTaakdefinitieInput) {
    const naam = requiredString(input.naam, "naam");
    const categorie = requiredString(input.categorie, "categorie");
    const frequentie = input.frequentie;
    const recordmanagerId = requiredString(input.recordmanagerId, "recordmanagerId");
    const proceseigenaarId = requiredString(
      input.proceseigenaarId,
      "proceseigenaarId"
    );
    const archivarisId = requiredString(input.archivarisId, "archivarisId");
    const stekkers = input.stekkers ?? [];

    if (
      frequentie !== "jaarlijks" &&
      frequentie !== "kwartaal" &&
      frequentie !== "maandelijks" &&
      frequentie !== "ad_hoc"
    ) {
      throw new BadRequestException("frequentie heeft een onbekende waarde.");
    }

    if (recordmanagerId === archivarisId || proceseigenaarId === archivarisId) {
      throw new BadRequestException(
        "Functiescheiding: archivaris mag niet gelijk zijn aan recordmanager of proceseigenaar."
      );
    }

    if (
      input.startmaand !== undefined &&
      input.startmaand !== null &&
      (input.startmaand < 1 || input.startmaand > 12)
    ) {
      throw new BadRequestException("startmaand moet tussen 1 en 12 liggen.");
    }

    return {
      naam,
      omschrijving: input.omschrijving,
      categorie,
      frequentie,
      startmaand: input.startmaand ?? null,
      recordmanagerId,
      proceseigenaarId,
      archivarisId,
      stekkers: stekkers.map((stekker) => ({
        stekkerId: requiredString(stekker.stekkerId, "stekkerId"),
        selectieparameters: stekker.selectieparameters ?? {},
      })),
    };
  }

  private async validateMedewerkers(data: {
    recordmanagerId: string;
    proceseigenaarId: string;
    archivarisId: string;
  }) {
    const medewerkers = await this.prisma.client.medewerker.findMany({
      where: {
        id: {
          in: [data.recordmanagerId, data.proceseigenaarId, data.archivarisId],
        },
        actief: true,
      },
      select: {
        id: true,
        rollen: true,
      },
    });

    const rolesById = new Map(
      medewerkers.map((medewerker) => [medewerker.id, medewerker.rollen])
    );

    requireRole(rolesById, data.recordmanagerId, "recordmanager");
    requireRole(rolesById, data.proceseigenaarId, "proceseigenaar");
    requireRole(rolesById, data.archivarisId, "archivaris");
  }

  private async validateStekkers(stekkers: TaakdefinitieStekkerInput[]) {
    if (stekkers.length === 0) {
      return;
    }

    const ids = [...new Set(stekkers.map((stekker) => stekker.stekkerId))];

    if (ids.length !== stekkers.length) {
      throw new BadRequestException("Stekkers mogen niet dubbel gekoppeld zijn.");
    }

    const count = await this.prisma.client.stekker.count({
      where: {
        id: { in: ids },
        actief: true,
      },
    });

    if (count !== ids.length) {
      throw new BadRequestException(
        "Een of meer stekkers bestaan niet of zijn niet actief."
      );
    }
  }

  private async createConfiguratieEvent(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    event: {
      actie: string;
      entiteitType: string;
      entiteitId: string;
            details: Prisma.InputJsonValue;
    }
  ) {
    const previous = await tx.configuratieEvent.findFirst({
      orderBy: { id: "desc" },
      select: { hash: true },
    });
    const correlatieId = randomUUID();
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          vorigeHash: previous?.hash ?? null,
          actorId: user.sub,
          actie: event.actie,
          entiteitType: event.entiteitType,
          entiteitId: event.entiteitId,
          details: event.details,
          correlatieId,
        })
      )
      .digest("hex");

    await tx.configuratieEvent.create({
      data: {
        actorType: "user",
        actorId: user.sub,
        actorNaam: user.name ?? user.username,
        rol: user.roles.includes("recordmanager") ? "recordmanager" : undefined,
        actie: event.actie,
        entiteitType: event.entiteitType,
        entiteitId: event.entiteitId,
        details: event.details,
        correlatieId,
        vorigeHash: previous?.hash,
        hash,
      },
    });
  }
}

function requiredString(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new BadRequestException(`${field} is verplicht.`);
  }

  return value.trim();
}

function parseOptionalDate(value: string | null | undefined, field: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is geen geldige datum.`);
  }

  return date;
}

function requireRole(
  rolesById: Map<string, string[]>,
  id: string,
  role: "recordmanager" | "proceseigenaar" | "archivaris"
) {
  if (!rolesById.get(id)?.includes(role)) {
    throw new BadRequestException(
      `Medewerker ${id} bestaat niet, is niet actief, of heeft rol ${role} niet.`
    );
  }
}
