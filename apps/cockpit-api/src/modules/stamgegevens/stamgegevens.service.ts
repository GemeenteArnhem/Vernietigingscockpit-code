import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth-user.js";
import type { AppRole } from "../auth/app-role.js";
import { isAppRole } from "../auth/app-role.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfConfiguratieEvent } from "../audit/audit-keten.js";
import { mapAfdeling, mapMedewerker } from "./stamgegevens.dto.js";
import type { ApiStamgegevensMedewerker } from "@vernietigingscockpit/api-contract";

type AfdelingImportInput = {
  code?: string;
  naam?: string;
  actief?: boolean;
};

type MedewerkerImportInput = {
  naam?: string;
  email?: string;
  rollen?: string[];
  afdelingCode?: string | null;
  actief?: boolean;
  bron?: string;
  externId?: string | null;
  archiefvormer?: { verwijzingNaam: string; verwijzingIdentificatie?: { identificatieKenmerk: string; identificatieBron: string } } | null;
};

export type StamgegevensImportInput = {
  afdelingen?: AfdelingImportInput[];
  medewerkers?: MedewerkerImportInput[];
};

@Injectable()
export class StamgegevensService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAfdelingen() {
    const afdelingen = await this.prisma.client.afdeling.findMany({
      orderBy: { naam: "asc" },
    });

    return afdelingen.map(mapAfdeling);
  }

  async getMedewerkers(rol?: AppRole): Promise<ApiStamgegevensMedewerker[]> {
    const medewerkers = await this.prisma.client.medewerker.findMany({
      where: {
        actief: true,
        ...(rol ? { rollen: { has: rol } } : {}),
      },
      include: {
        afdeling: true,
      },
      orderBy: { naam: "asc" },
    });

    return medewerkers.map(mapMedewerker);
  }

  async importStamgegevens(user: AuthUser, input: StamgegevensImportInput) {
    const afdelingen = (input.afdelingen ?? []).map(validateAfdeling);
    const medewerkers = (input.medewerkers ?? []).map(validateMedewerker);

    if (afdelingen.length === 0 && medewerkers.length === 0) {
      throw new BadRequestException(
        "Import bevat geen afdelingen of medewerkers."
      );
    }

    return this.prisma.client.$transaction(async (tx) => {
      const afdelingIdsByCode = new Map<string, string>();

      for (const afdeling of afdelingen) {
        const saved = await tx.afdeling.upsert({
          where: { code: afdeling.code },
          update: {
            naam: afdeling.naam,
            actief: afdeling.actief,
          },
          create: afdeling,
          select: {
            id: true,
            code: true,
          },
        });

        afdelingIdsByCode.set(saved.code, saved.id);
      }

      if (medewerkers.some((medewerker) => medewerker.afdelingCode)) {
        const bestaandeAfdelingen = await tx.afdeling.findMany({
          where: {
            code: {
              in: [
                ...new Set(
                  medewerkers
                    .map((medewerker) => medewerker.afdelingCode)
                    .filter((code): code is string => Boolean(code))
                ),
              ],
            },
          },
          select: {
            id: true,
            code: true,
          },
        });

        for (const afdeling of bestaandeAfdelingen) {
          afdelingIdsByCode.set(afdeling.code, afdeling.id);
        }
      }

      // Een proceseigenaar van een actieve taakdefinitie mag zijn archiefvormer niet kwijtraken
      // (ADR-0005, B-M3): anders kan er geen dossier meer worden aangemaakt.
      const zonderArchiefvormer = medewerkers.filter((medewerker) => medewerker.archiefvormer === null).map((m) => m.email);
      if (zonderArchiefvormer.length > 0) {
        const inGebruik = await tx.medewerker.findMany({
          where: {
            email: { in: zonderArchiefvormer },
            taakdefinitiesPo: { some: { actief: true, verwijderdOp: null } },
          },
          select: { naam: true },
        });
        if (inGebruik.length > 0) {
          throw new BadRequestException(
            `De archiefvormer kan niet worden gewist voor proceseigenaar(s) van een actieve taakdefinitie: ${inGebruik.map((m) => m.naam).join(", ")}.`
          );
        }
      }

      for (const medewerker of medewerkers) {
        const afdelingId = medewerker.afdelingCode
          ? afdelingIdsByCode.get(medewerker.afdelingCode)
          : null;

        if (medewerker.afdelingCode && !afdelingId) {
          throw new BadRequestException(
            `Afdeling ${medewerker.afdelingCode} bestaat niet.`
          );
        }

        await tx.medewerker.upsert({
          where: { email: medewerker.email },
          update: {
            naam: medewerker.naam,
            rollen: medewerker.rollen,
            afdelingId,
            actief: medewerker.actief,
            bron: medewerker.bron,
            externId: medewerker.externId,
            // Weglaten laat de bestaande waarde staan; null wist hem.
            ...(medewerker.archiefvormer !== undefined ? { archiefvormer: medewerker.archiefvormer ?? Prisma.DbNull } : {}),
          },
          create: {
            naam: medewerker.naam,
            email: medewerker.email,
            rollen: medewerker.rollen,
            afdelingId,
            actief: medewerker.actief,
            bron: medewerker.bron,
            externId: medewerker.externId,
            ...(medewerker.archiefvormer ? { archiefvormer: medewerker.archiefvormer } : {}),
          },
        });
      }

      await schrijfConfiguratieEvent(tx, { type: "user", user, rol: "functioneel_beheerder" }, {
        eventType: "Stamgegevens geïmporteerd",
        entiteitType: "stamgegevens",
        entiteitId: "stamgegevens",
        details: {
          afdelingen: afdelingen.length,
          medewerkers: medewerkers.length,
        },
      });

      return {
        afdelingen: afdelingen.length,
        medewerkers: medewerkers.length,
      };
    });
  }
}

function validateAfdeling(input: AfdelingImportInput) {
  return {
    code: requiredString(input.code, "afdeling.code").toUpperCase(),
    naam: requiredString(input.naam, "afdeling.naam"),
    actief: input.actief ?? true,
  };
}

function validateMedewerker(input: MedewerkerImportInput) {
  const rollen = input.rollen ?? [];

  if (rollen.length === 0) {
    throw new BadRequestException("medewerker.rollen is verplicht.");
  }

  return {
    naam: requiredString(input.naam, "medewerker.naam"),
    email: requiredString(input.email, "medewerker.email").toLowerCase(),
    rollen: rollen.map(validateRole),
    afdelingCode: input.afdelingCode?.toUpperCase() ?? null,
    actief: input.actief ?? true,
    bron: input.bron?.trim() || "import",
    externId: input.externId?.trim() || null,
    archiefvormer: input.archiefvormer,
  };
}

function validateRole(role: string): AppRole {
  if (!isAppRole(role)) {
    throw new BadRequestException(`Onbekende rol: ${role}.`);
  }

  return role;
}

function requiredString(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new BadRequestException(`${field} is verplicht.`);
  }

  return value.trim();
}
