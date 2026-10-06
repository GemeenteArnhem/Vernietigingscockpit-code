import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { actionsForRoles } from "../auth/app-action.js";
import { PrismaService } from "../../shared/db/prisma.service.js";
import { CurrentMedewerkerService } from "../auth/current-medewerker.service.js";
import type { ApiMe } from "@vernietigingscockpit/api-contract";

@Injectable()
export class MeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurrentMedewerkerService) private readonly currentMedewerker: CurrentMedewerkerService
  ) {}

  async getMe(user: AuthUser): Promise<ApiMe> {
    const medewerker = await this.findMedewerker(user);
    const name = user.name ?? user.username ?? user.email ?? user.sub;

    // De koppeling met de medewerker verandert hier niet (CC-12); alleen het profiel.
    const dbUser = await this.prisma.client.gebruiker.upsert({
      where: { id: user.sub },
      update: {
        naam: name,
        email: user.email,
        rollen: user.roles,
        laatstGezien: new Date(),
      },
      create: {
        id: user.sub,
        medewerkerId: medewerker?.id,
        naam: name,
        email: user.email,
        rollen: user.roles,
      },
      select: {
        id: true,
        medewerkerId: true,
        naam: true,
        email: true,
        rollen: true,
        laatstGezien: true,
      },
    });

    return {
      id: dbUser.id,
      username: user.username,
      name: dbUser.naam,
      email: dbUser.email,
      roles: dbUser.rollen,
      medewerkerId: dbUser.medewerkerId,
      medewerker: medewerker
        ? {
            id: medewerker.id,
            naam: medewerker.naam,
            email: medewerker.email,
            afdeling: medewerker.afdeling,
          }
        : null,
      actions: actionsForRoles(dbUser.rollen),
      laatstGezien: dbUser.laatstGezien.toISOString(),
    };
  }

  private async findMedewerker(user: AuthUser) {
    const medewerkerId = await this.currentMedewerker.findForUser(user);

    return medewerkerId
      ? this.prisma.client.medewerker.findUnique({ where: { id: medewerkerId }, include: { afdeling: true } })
      : null;
  }
}
