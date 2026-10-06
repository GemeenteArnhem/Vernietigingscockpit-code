import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import {
  mapTaakdefinitie,
  mapTaakdefinitieMetActies,
  taakdefinitieSelect,
} from "./taakdefinities.dto.js";
import { taakdefinitieActies, taakinstantieActies } from "../workflow/toegestane-acties.js";
import {
  mapTaakinstantie,
  taakinstantieSelect,
} from "../taken/taken.dto.js";
import { schrijfAuditEvent, schrijfConfiguratieEvent } from "../audit/audit-keten.js";
import type { ApiTaakdefinitie, ApiTaakinstantie } from "@vernietigingscockpit/api-contract";

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

  async getTaakdefinities(user: AuthUser, scope: "mijn" | "alle"): Promise<ApiTaakdefinitie[]> {
    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const where = await this.buildAccessWhere(user, scope);
    const taakdefinities = await this.prisma.client.taakdefinitie.findMany({
      where,
      select: taakdefinitieSelect,
      orderBy: { naam: "asc" },
    });

    return taakdefinities.map((taakdefinitie) =>
      mapTaakdefinitieMetActies(
        taakdefinitie,
        taakdefinitieActies(taakdefinitie, {
          roles: user.roles,
          medewerkerId,
        }),
        (instantie) =>
          taakinstantieActies(instantie, {
            roles: user.roles,
            medewerkerId,
          })
      )
    );
  }

  async getTaakdefinitie(user: AuthUser, id: string): Promise<ApiTaakdefinitie> {
    const medewerkerId = await this.currentMedewerker.findForUser(user);
    const taakdefinitie = await this.prisma.client.taakdefinitie.findFirstOrThrow({
      where: {
        id,
        ...(await this.buildDetailAccessWhere(user)),
      },
      select: taakdefinitieSelect,
    });

    return mapTaakdefinitieMetActies(
      taakdefinitie,
      taakdefinitieActies(taakdefinitie, {
        roles: user.roles,
        medewerkerId,
      }),
      (instantie) =>
        taakinstantieActies(instantie, {
          roles: user.roles,
          medewerkerId,
        })
    );
  }

  private async buildAccessWhere(user: AuthUser, scope: "mijn" | "alle") {
    const canSeeAll =
      user.roles.includes("auditor") ||
      user.roles.includes("functioneel_beheerder");

    if (scope === "alle" && canSeeAll) {
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
    const canSeeAll =
      user.roles.includes("auditor") ||
      user.roles.includes("functioneel_beheerder");

    return this.buildAccessWhere(user, canSeeAll ? "alle" : "mijn");
  }

  async createTaakdefinitie(user: AuthUser, input: CreateTaakdefinitieInput): Promise<ApiTaakdefinitie> {
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

      await schrijfConfiguratieEvent(tx, { type: "user", user, rol: "recordmanager" }, {
        entiteitType: "taakdefinitie",
        entiteitId: created.id,
        actie: "TASK_DEFINITION_CREATED",
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
  ): Promise<ApiTaakinstantie> {
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

      // Begin van de auditketen van deze taak (ADR-0003).
      await schrijfAuditEvent(tx, { type: "user", user, rol: "recordmanager" }, {
        taakinstantieId: created.id,
        entiteitType: "taakinstantie",
        entiteitId: created.id,
        actie: "TASK_CREATED",
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

    if (
      recordmanagerId === proceseigenaarId ||
      recordmanagerId === archivarisId ||
      proceseigenaarId === archivarisId
    ) {
      throw new BadRequestException(
        "Functiescheiding: recordmanager, proceseigenaar en archivaris moeten drie verschillende personen zijn."
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
