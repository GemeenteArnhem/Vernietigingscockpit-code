import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { ApiStekkerBeheer, StekkerGevalideerd } from "@vernietigingscockpit/api-contract";
import type { AuthUser } from "../auth/auth-user.js";
import { schrijfConfiguratieEvent, type AuditActor } from "../audit/audit-keten.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { GeheimFout, leesSleutel, versleutel } from "../../shared/geheim/geheim.js";

// Stekkerbeheer door de functioneel beheerder (bouwplan §7.1).
// - Elke wijziging maakt een nieuwe, onveranderlijke stekker_configuratie-versie; lopende
//   selecties houden hun vastgepinde versie.
// - Het secret wordt versleuteld opgeslagen en nooit teruggegeven (alleen 'secretIngesteld').
// - Verwijderen = deactiveren; echt verwijderen alleen als de stekker nooit is gebruikt.
// - Elke handeling staat in het configuratielog (CONNECTOR_*, concept-ADR-0003).

const stekkerSelect = {
  id: true,
  naam: true,
  omschrijving: true,
  actief: true,
  configuraties: { orderBy: { versie: "desc" } },
  _count: { select: { taakdefinities: true } },
} satisfies Prisma.StekkerSelect;

type StekkerRecord = Prisma.StekkerGetPayload<{ select: typeof stekkerSelect }>;

@Injectable()
export class StekkerbeheerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  async lijst(): Promise<ApiStekkerBeheer[]> {
    const stekkers = await this.prisma.client.stekker.findMany({ select: stekkerSelect, orderBy: { naam: "asc" } });
    const selecties = await this.selectiesPerStekker(stekkers.map((stekker) => stekker.id));
    return stekkers.map((stekker) => mapStekker(stekker, selecties.get(stekker.id) ?? 0));
  }

  async detail(id: string): Promise<ApiStekkerBeheer> {
    const stekker = await this.prisma.client.stekker.findUnique({ where: { id }, select: stekkerSelect });

    if (!stekker) {
      throw new NotFoundException("Stekker niet gevonden.");
    }

    return mapStekker(stekker, (await this.selectiesPerStekker([id])).get(id) ?? 0);
  }

  async aanmaken(user: AuthUser, invoer: StekkerGevalideerd): Promise<ApiStekkerBeheer> {
    this.controleerAuthenticatie(invoer);
    const secretVersleuteld = invoer.authType === "oauth2_cc" && invoer.secret ? this.versleutel(invoer.secret) : null;

    const id = await this.prisma.client.$transaction(async (tx) => {
      const stekker = await tx.stekker.create({
        data: { naam: invoer.naam, omschrijving: invoer.omschrijving ?? null },
        select: { id: true },
      });
      await tx.stekkerConfiguratie.create({
        data: { stekkerId: stekker.id, versie: 1, ...configuratieData(invoer, secretVersleuteld), aangemaaktDoor: user.sub },
      });
      await schrijfConfiguratieEvent(tx, actor(user), {
        entiteitType: "stekker",
        entiteitId: stekker.id,
        actie: "CONNECTOR_CREATED",
        details: { naam: invoer.naam, ...logbareConfiguratie(invoer, secretVersleuteld !== null), versie: 1 },
      });
      return stekker.id;
    });

    return this.detail(id);
  }

  // Bewerken met de verwachte configuratieversie (If-Match): een tussentijdse wijziging door
  // een ander geeft 412.
  async bewerken(user: AuthUser, id: string, verwachteVersie: number, invoer: StekkerGevalideerd): Promise<ApiStekkerBeheer> {
    this.controleerAuthenticatie(invoer);
    const nieuwSecret = invoer.authType === "oauth2_cc" && invoer.secret ? this.versleutel(invoer.secret) : null;

    await this.prisma.client.$transaction(async (tx) => {
      const huidige = await tx.stekkerConfiguratie.findFirst({ where: { stekkerId: id }, orderBy: { versie: "desc" } });

      if (!huidige) {
        throw new NotFoundException("Stekker niet gevonden.");
      }

      if (huidige.versie !== verwachteVersie) {
        throw new PreconditionFailedException("De stekker is intussen gewijzigd. Laad de gegevens opnieuw.");
      }

      // Geen nieuw secret ingevuld: het bestaande houden (alleen bij OAuth2).
      const secretVersleuteld = invoer.authType === "oauth2_cc" ? nieuwSecret ?? huidige.secretVersleuteld : null;
      const versie = huidige.versie + 1;

      await tx.stekker.update({ where: { id }, data: { naam: invoer.naam, omschrijving: invoer.omschrijving ?? null } });
      await tx.stekkerConfiguratie.create({
        data: { stekkerId: id, versie, ...configuratieData(invoer, secretVersleuteld), aangemaaktDoor: user.sub },
      });
      await schrijfConfiguratieEvent(tx, actor(user), {
        entiteitType: "stekker",
        entiteitId: id,
        actie: "CONNECTOR_UPDATED",
        details: {
          naam: invoer.naam,
          ...logbareConfiguratie(invoer, secretVersleuteld !== null),
          versie,
          vorigeVersie: huidige.versie,
          secretGewijzigd: nieuwSecret !== null,
        },
      });
    });

    return this.detail(id);
  }

  async zetActief(user: AuthUser, id: string, actief: boolean): Promise<ApiStekkerBeheer> {
    await this.prisma.client.$transaction(async (tx) => {
      const { count } = await tx.stekker.updateMany({ where: { id, actief: !actief }, data: { actief } });

      if (count === 0) {
        await this.bestaatOfFout(tx, id);
        throw new ConflictException(actief ? "De stekker is al actief." : "De stekker is al inactief.");
      }

      await schrijfConfiguratieEvent(tx, actor(user), {
        entiteitType: "stekker",
        entiteitId: id,
        actie: actief ? "CONNECTOR_ACTIVATED" : "CONNECTOR_DEACTIVATED",
        details: {},
      });
    });

    return this.detail(id);
  }

  // Echt verwijderen kan alleen als de stekker nergens is gebruikt; anders deactiveren.
  async verwijderen(user: AuthUser, id: string) {
    try {
      await this.prisma.client.$transaction(async (tx) => {
        const stekker = await this.bestaatOfFout(tx, id);
        const [taakdefinities, selecties] = await Promise.all([
          tx.taakdefinitieStekker.count({ where: { stekkerId: id } }),
          tx.selectie.count({ where: { stekkerId: id } }),
        ]);

        if (taakdefinities > 0 || selecties > 0) {
          throw new ConflictException(
            "Deze stekker is in gebruik (taakdefinities of selecties) en kan niet worden verwijderd. Deactiveer hem in plaats daarvan."
          );
        }

        await tx.stekkerConfiguratie.deleteMany({ where: { stekkerId: id } });
        await tx.stekker.delete({ where: { id } });
        await schrijfConfiguratieEvent(tx, actor(user), {
          entiteitType: "stekker",
          entiteitId: id,
          actie: "CONNECTOR_DELETED",
          details: { naam: stekker.naam },
        });
      });
    } catch (error) {
      // Gelijktijdig gekoppeld aan een taakdefinitie: de foreign key houdt het tegen.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException("Deze stekker is intussen in gebruik genomen en kan niet worden verwijderd.");
      }
      throw error;
    }
  }

  private async bestaatOfFout(tx: Prisma.TransactionClient, id: string) {
    const stekker = await tx.stekker.findUnique({ where: { id }, select: { naam: true } });

    if (!stekker) {
      throw new NotFoundException("Stekker niet gevonden.");
    }

    return stekker;
  }

  private controleerAuthenticatie(invoer: StekkerGevalideerd) {
    if (invoer.authType === "none" && this.config.get<string>("NODE_ENV") === "production") {
      throw new BadRequestException("Stekkerauthenticatie 'geen' is niet toegestaan in productie.");
    }
  }

  private versleutel(secret: string) {
    try {
      return versleutel(secret, leesSleutel(this.config.get<string>("SECRET_ENCRYPTION_KEY")));
    } catch (error) {
      if (error instanceof GeheimFout) {
        throw new ServiceUnavailableException(
          "Secrets opslaan kan niet: SECRET_ENCRYPTION_KEY is niet (goed) ingesteld op de server."
        );
      }
      throw error;
    }
  }

  private async selectiesPerStekker(ids: string[]) {
    const rijen = await this.prisma.client.selectie.groupBy({ by: ["stekkerId"], where: { stekkerId: { in: ids } }, _count: true });
    return new Map(rijen.map((rij) => [rij.stekkerId, rij._count]));
  }
}

function actor(user: AuthUser): AuditActor {
  return { type: "user", user, rol: "functioneel_beheerder" };
}

function configuratieData(invoer: StekkerGevalideerd, secretVersleuteld: string | null) {
  const oauth = invoer.authType === "oauth2_cc";
  return {
    baseUrl: invoer.baseUrl,
    authType: invoer.authType,
    tokenUrl: oauth ? invoer.tokenUrl ?? null : null,
    clientId: oauth ? invoer.clientId ?? null : null,
    secretRef: oauth ? invoer.secretRef ?? null : null,
    secretVersleuteld,
    scopes: invoer.scopes,
    verwachteApiMajor: invoer.verwachteApiMajor,
    timeouts: invoer.timeouts as Prisma.InputJsonValue,
    parameters: invoer.parameters as Prisma.InputJsonValue,
  };
}

// Wat in het configuratielog mag: nooit het secret zelf.
function logbareConfiguratie(invoer: StekkerGevalideerd, secretIngesteld: boolean) {
  return {
    baseUrl: invoer.baseUrl,
    authType: invoer.authType,
    tokenUrl: invoer.tokenUrl ?? null,
    clientId: invoer.clientId ?? null,
    secretRef: invoer.secretRef ?? null,
    secretIngesteld,
    scopes: invoer.scopes,
    verwachteApiMajor: invoer.verwachteApiMajor,
  };
}

function mapStekker(stekker: StekkerRecord, selecties: number): ApiStekkerBeheer {
  const [laatste] = stekker.configuraties;
  const gebruik = { taakdefinities: stekker._count.taakdefinities, selecties };
  const ongebruikt = gebruik.taakdefinities === 0 && gebruik.selecties === 0;

  return {
    id: stekker.id,
    naam: stekker.naam,
    omschrijving: stekker.omschrijving,
    actief: stekker.actief,
    gebruik,
    configuratie: laatste
      ? {
          versie: laatste.versie,
          baseUrl: laatste.baseUrl,
          authType: laatste.authType,
          tokenUrl: laatste.tokenUrl,
          clientId: laatste.clientId,
          secretIngesteld: laatste.secretVersleuteld !== null,
          secretRef: laatste.secretRef,
          scopes: laatste.scopes,
          verwachteApiMajor: laatste.verwachteApiMajor,
          timeouts: (laatste.timeouts ?? {}) as Record<string, unknown>,
          parameters: (laatste.parameters ?? {}) as Record<string, unknown>,
          aangemaaktDoor: laatste.aangemaaktDoor,
          aangemaaktOp: laatste.aangemaaktOp.toISOString(),
        }
      : null,
    versies: stekker.configuraties.map((configuratie) => ({
      versie: configuratie.versie,
      aangemaaktDoor: configuratie.aangemaaktDoor,
      aangemaaktOp: configuratie.aangemaaktOp.toISOString(),
    })),
    toegestaneActies: [
      "stekker.bewerken",
      stekker.actief ? "stekker.deactiveren" : "stekker.activeren",
      ...(ongebruikt ? ["stekker.verwijderen"] : []),
    ],
  };
}
