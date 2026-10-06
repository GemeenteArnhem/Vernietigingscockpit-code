import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
});

afterAll(async () => {
  await db?.stop();
});

describe("append-only auditlogs", () => {
  it("weigert UPDATE en DELETE op audit_event", async () => {
    const event = await db.prisma.client.auditEvent.create({
      data: {
        taakinstantieId: basis.taak.id,
        actorType: "user",
        actie: "TASK_CREATED",
        entiteitType: "taakinstantie",
        entiteitId: basis.taak.id,
        details: {},
        hash: "test",
      },
    });

    await expect(
      db.prisma.client.auditEvent.update({ where: { id: event.id }, data: { actie: "GEWIJZIGD" } })
    ).rejects.toThrow(/append-only/);
    await expect(db.prisma.client.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
  });

  it("weigert UPDATE en DELETE op configuratie_event", async () => {
    const event = await db.prisma.client.configuratieEvent.create({
      data: {
        actorType: "user",
        actie: "TASKDEF_CREATED",
        entiteitType: "taakdefinitie",
        entiteitId: "x",
        details: {},
        hash: "test",
      },
    });

    await expect(
      db.prisma.client.configuratieEvent.update({ where: { id: event.id }, data: { actie: "GEWIJZIGD" } })
    ).rejects.toThrow(/append-only/);
    await expect(db.prisma.client.configuratieEvent.delete({ where: { id: event.id } })).rejects.toThrow(
      /append-only/
    );
  });
});

describe("functiescheiding in de database", () => {
  it("weigert een taakdefinitie waarin de recordmanager ook archivaris is", async () => {
    await expect(
      db.prisma.client.taakdefinitie.create({
        data: {
          naam: "Ongeldig",
          categorie: "Test",
          frequentie: "ad_hoc",
          recordmanagerId: basis.rm.id,
          proceseigenaarId: basis.po.id,
          archivarisId: basis.rm.id,
        },
      })
    ).rejects.toThrow(/taakdefinitie_functiescheiding/);
  });
});
