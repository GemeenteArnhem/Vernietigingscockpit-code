import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../shared/db/prisma.service.js";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getLive() {
    return {
      status: "ok",
      app: "cockpit-api",
      timestamp: new Date().toISOString(),
    };
  }

  // Publiek bereikbaar: geen foutdetails in het antwoord (CC-11), alleen in de log.
  async getReady() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;

      return {
        status: "ok",
        checks: {
          database: "ok",
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Database niet bereikbaar: ${error instanceof Error ? error.name : "onbekende fout"}`);
      throw new ServiceUnavailableException({
        status: "unavailable",
        checks: {
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
