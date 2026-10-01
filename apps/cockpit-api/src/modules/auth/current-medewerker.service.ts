import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "./auth-user.js";
import { PrismaService } from "../../shared/db/prisma.service.js";

@Injectable()
export class CurrentMedewerkerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findForUser(user: AuthUser) {
    if (user.username) {
      const medewerker = await this.prisma.client.medewerker.findFirst({
        where: {
          externId: user.username,
          actief: true,
        },
        select: { id: true },
      });

      if (medewerker) {
        return medewerker.id;
      }
    }

    if (user.email) {
      const medewerker = await this.prisma.client.medewerker.findFirst({
        where: {
          email: user.email,
          actief: true,
        },
        select: { id: true },
      });

      if (medewerker) {
        return medewerker.id;
      }
    }

    if (!user.sub) {
      return null;
    }

    try {
      const gebruiker = await this.prisma.client.gebruiker.findUnique({
        where: { id: user.sub },
        select: {
          medewerkerId: true,
        },
      });

      return gebruiker?.medewerkerId ?? null;
    } catch {
      return null;
    }
  }
}
