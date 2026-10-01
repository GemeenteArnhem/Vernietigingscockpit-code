import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientModule from "@prisma/client";

const { PrismaClient } = prismaClientModule;

export function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });

  return new PrismaClient({ adapter });
}
