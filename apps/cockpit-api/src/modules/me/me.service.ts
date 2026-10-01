import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.js";
import { actionsForRoles } from "../auth/app-action.js";
import { PrismaService } from "../../shared/db/prisma.service.js";

@Injectable()
export class MeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMe(user: AuthUser) {
    const medewerker = await this.findMedewerker(user);
    const name = user.name ?? user.username ?? user.email ?? user.sub;

    const dbUser = await this.prisma.client.gebruiker.upsert({
      where: { id: user.sub },
      update: {
        medewerkerId: medewerker?.id ?? null,
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
    const externId = user.username;

    if (externId) {
      const medewerker = await this.prisma.client.medewerker.findFirst({
        where: {
          externId,
          actief: true,
        },
        include: {
          afdeling: true,
        },
      });

      if (medewerker) {
        return medewerker;
      }
    }

    if (!user.email) {
      return null;
    }

    return this.prisma.client.medewerker.findFirst({
      where: {
        email: user.email,
        actief: true,
      },
      include: {
        afdeling: true,
      },
    });
  }
}
