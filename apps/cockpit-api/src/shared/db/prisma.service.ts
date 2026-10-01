import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const databaseUrl = config.get<string>("DATABASE_URL");

    if (!databaseUrl) {
      throw new Error("DATABASE_URL ontbreekt.");
    }

    this.client = createPrismaClient(databaseUrl);
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
