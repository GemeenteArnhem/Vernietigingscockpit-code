import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../shared/db/prisma.service.js";

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getLive() {
    return {
      status: "ok",
      app: "cockpit-api",
      timestamp: new Date().toISOString(),
    };
  }

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
      throw new ServiceUnavailableException({
        status: "unavailable",
        checks: {
          database: "unavailable",
        },
        error: this.describeError(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      name: "UnknownError",
      message: "Onbekende databasefout.",
    };
  }
}
