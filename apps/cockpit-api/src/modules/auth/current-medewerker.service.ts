import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "./auth-user.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfConfiguratieEvent } from "../audit/audit-keten.js";

// Identiteit op de stabiele OIDC-`sub` (CC-12).
//
// Een gebruiker (sub) is via de tabel `gebruiker` aan één medewerker gekoppeld. De koppeling
// ontstaat eenmalig bij de eerste login: op gebruikersnaam (extern_id), of op e-mail als de
// IdP het adres als geverifieerd meldt. Daarna telt alleen nog de sub: een gewijzigde
// gebruikersnaam of e-mail bij de IdP verandert niet wie iemand in de cockpit is.
@Injectable()
export class CurrentMedewerkerService {
  private readonly logger = new Logger(CurrentMedewerkerService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findForUser(user: AuthUser) {
    if (!user.sub) {
      return null;
    }

    const gebruiker = await this.prisma.client.gebruiker.findUnique({
      where: { id: user.sub },
      select: { medewerkerId: true, medewerker: { select: { actief: true } } },
    });

    if (gebruiker?.medewerkerId) {
      return gebruiker.medewerker?.actief ? gebruiker.medewerkerId : null;
    }

    return this.koppelEersteKeer(user);
  }

  private async koppelEersteKeer(user: AuthUser) {
    const rol = user.roles[0];

    if (!rol) {
      return null;
    }

    // Alleen actieve medewerkers die nog aan geen andere gebruiker gekoppeld zijn.
    const vrij = { actief: true, gebruiker: { is: null } } as const;
    const opNaam = user.username
      ? await this.prisma.client.medewerker.findFirst({ where: { ...vrij, externId: user.username }, select: { id: true } })
      : null;
    const opEmail =
      !opNaam && user.email && user.emailVerified === true
        ? await this.prisma.client.medewerker.findFirst({ where: { ...vrij, email: user.email }, select: { id: true } })
        : null;
    const medewerker = opNaam ?? opEmail;

    if (!medewerker) {
      // Mogelijk heeft een gelijktijdig verzoek deze gebruiker net gekoppeld.
      return this.gekoppeldeMedewerker(user.sub);
    }

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const bestaand = await tx.gebruiker.findUnique({ where: { id: user.sub }, select: { medewerkerId: true } });

        if (bestaand?.medewerkerId) {
          return; // gelijktijdig al gekoppeld
        }

        if (bestaand) {
          await tx.gebruiker.update({ where: { id: user.sub }, data: { medewerkerId: medewerker.id } });
        } else {
          await tx.gebruiker.create({
            data: {
              id: user.sub,
              medewerkerId: medewerker.id,
              naam: user.name ?? user.username ?? user.sub,
              email: user.email,
              rollen: user.roles,
            },
          });
        }

        await schrijfConfiguratieEvent(tx, { type: "user", user, rol }, {
          actie: "USER_LINKED",
          entiteitType: "gebruiker",
          entiteitId: user.sub,
          details: { medewerkerId: medewerker.id, gekoppeldOp: opNaam ? "gebruikersnaam" : "e-mail (geverifieerd)" },
        });
      });
    } catch (error) {
      // Unieke medewerker_id of gebruiker-id: een gelijktijdig verzoek of een andere
      // gebruiker was ons voor. Hieronder opnieuw lezen wat er nu vastligt.
      this.logger.warn(`Koppeling van gebruiker aan medewerker niet gelukt: ${error instanceof Error ? error.name : "onbekend"}`);
    }

    return this.gekoppeldeMedewerker(user.sub);
  }

  private async gekoppeldeMedewerker(sub: string) {
    const gebruiker = await this.prisma.client.gebruiker.findUnique({ where: { id: sub }, select: { medewerkerId: true } });
    return gebruiker?.medewerkerId ?? null;
  }
}
