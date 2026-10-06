import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/db/prisma.service.js";
import type { ApiStekkerOptie } from "@vernietigingscockpit/api-contract";

@Injectable()
export class StekkersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getStekkers(): Promise<ApiStekkerOptie[]> {
    const stekkers = await this.prisma.client.stekker.findMany({
      where: {
        actief: true,
      },
      select: {
        id: true,
        naam: true,
        omschrijving: true,
        actief: true,
        configuraties: {
          select: {
            versie: true,
            baseUrl: true,
            authType: true,
            verwachteApiMajor: true,
            aangemaaktOp: true,
          },
          orderBy: {
            versie: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        naam: "asc",
      },
    });

    return stekkers.map((stekker) => ({
      id: stekker.id,
      naam: stekker.naam,
      omschrijving: stekker.omschrijving,
      actief: stekker.actief,
      laatsteConfiguratie: stekker.configuraties[0] ?? null,
    }));
  }
}
