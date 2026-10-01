import { Controller, Get, Inject } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { PrismaService } from "../../shared/db/prisma.service.js";

@Controller("stekkers")
export class StekkersController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Roles("recordmanager", "functioneel_beheerder", "auditor")
  async getStekkers() {
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
