import type { AuthUser } from "../../../src/modules/auth/auth-user.js";
import type { PrismaService } from "../../../src/shared/db/prisma.service.js";

// Minimale, fictieve basisdata: drie medewerkers, één stekker met configuratie,
// een taakdefinitie en een taakinstantie in status init.
export async function maakBasisdata(prisma: PrismaService) {
  const db = prisma.client;
  const medewerker = (naam: string, externId: string, rol: "recordmanager" | "proceseigenaar" | "archivaris") =>
    db.medewerker.create({
      data: { naam, email: `${externId}@example.test`, rollen: [rol], bron: "test", externId },
    });

  const rm = await medewerker("Rita Recordmanager", "rm1", "recordmanager");
  const po = await medewerker("Peter Proceseigenaar", "po1", "proceseigenaar");
  const arch = await medewerker("Anna Archivaris", "arch1", "archivaris");

  const stekker = await db.stekker.create({ data: { naam: "Teststekker" } });
  await db.stekkerConfiguratie.create({
    data: {
      stekkerId: stekker.id,
      versie: 1,
      baseUrl: "http://teststekker.invalid",
      authType: "none",
      scopes: [],
      parameters: {},
      verwachteApiMajor: 1,
      timeouts: {},
      aangemaaktDoor: "test",
    },
  });

  const taakdefinitie = await db.taakdefinitie.create({
    data: {
      naam: "Testdefinitie",
      categorie: "Test",
      frequentie: "ad_hoc",
      recordmanagerId: rm.id,
      proceseigenaarId: po.id,
      archivarisId: arch.id,
      stekkers: { create: { stekkerId: stekker.id, selectieparameters: {} } },
    },
  });

  const taak = await db.taakinstantie.create({
    data: {
      taakdefinitieId: taakdefinitie.id,
      naam: "Testtaak",
      status: "init",
      recordmanagerId: rm.id,
      proceseigenaarId: po.id,
      archivarisId: arch.id,
    },
  });

  return { rm, po, arch, stekker, taakdefinitie, taak };
}

export function gebruiker(externId: string, rol: AuthUser["roles"][number]): AuthUser {
  return {
    sub: `sub-${externId}`,
    username: externId,
    name: externId,
    email: `${externId}@example.test`,
    roles: [rol],
    issuer: "https://idp.test",
    audience: "cockpit-api",
  };
}
