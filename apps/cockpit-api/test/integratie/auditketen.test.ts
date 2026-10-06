import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NotFoundException } from "@nestjs/common";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schrijfAuditEvent, schrijfConfiguratieEvent } from "../../src/modules/audit/audit-keten.js";
import { AuditService } from "../../src/modules/audit/audit.service.js";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";

const migratie = fs.readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../prisma/migrations/20261002140000_audit_keten_app_rol/migration.sql"
  ),
  "utf8"
);
// Alleen het eerste controleblok (lege auditlogs).
const migratieControle = migratie.slice(migratie.indexOf("DO $$"), migratie.indexOf("END $$;") + "END $$;".length);

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let audit: AuditService;
let app: pg.Client;

const rm = gebruiker("rm1", "recordmanager");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  audit = new AuditService(db.prisma, new CurrentMedewerkerService(db.prisma));
  app = new pg.Client({ connectionString: db.appUrl });
  await app.connect();
});

afterAll(async () => {
  await app?.end();
  await db?.stop();
});

async function nieuweTaak() {
  return db.prisma.client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "Audit",
      status: "init",
      recordmanagerId: basis.rm.id,
      proceseigenaarId: basis.po.id,
      archivarisId: basis.arch.id,
    },
  });
}

const schrijf = (taakinstantieId: string, nummer: number) =>
  db.prisma.client.$transaction((tx) =>
    schrijfAuditEvent(tx, { type: "user", user: rm, rol: "recordmanager" }, {
      taakinstantieId,
      actie: "OBJECT_INCLUDED",
      entiteitType: "vernietigingskandidaat",
      entiteitId: `k-${nummer}`,
      details: { nummer, genest: { b: 2, a: 1 } },
    })
  );

describe("keten per taakinstantie", () => {
  it("blijft intact bij 25 gelijktijdige schrijvers (geen vertakkingen)", async () => {
    const taak = await nieuweTaak();

    await Promise.all(Array.from({ length: 25 }, (_, nummer) => schrijf(taak.id, nummer)));

    const verificatie = await audit.verifieer(rm, taak.id);
    expect(verificatie).toMatchObject({ intact: true, aantalEvents: 25, fouten: [] });

    const vorige = await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: taak.id }, select: { vorigeHash: true } });
    expect(new Set(vorige.map((event) => event.vorigeHash)).size).toBe(25);
  });

  it("houdt de ketens van twee taken gescheiden", async () => {
    const [a, b] = [await nieuweTaak(), await nieuweTaak()];

    await Promise.all([schrijf(a.id, 1), schrijf(b.id, 1), schrijf(a.id, 2), schrijf(b.id, 2)]);

    for (const taak of [a, b]) {
      const events = await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: taak.id }, orderBy: { id: "asc" } });
      expect(events[0].vorigeHash).toBeNull();
      expect(events[1].vorigeHash).toBe(events[0].hash);
      expect((await audit.verifieer(rm, taak.id)).intact).toBe(true);
    }
  });

  it("ontdekt een wijziging buiten de applicatie om", async () => {
    const taak = await nieuweTaak();
    for (const nummer of [1, 2, 3]) {
      await schrijf(taak.id, nummer);
    }
    const [, midden] = await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: taak.id }, orderBy: { id: "asc" } });

    // Alleen een superuser kan de trigger uitzetten; zo bootsen we manipulatie na.
    await db.prisma.client.$transaction([
      db.prisma.client.$executeRawUnsafe('ALTER TABLE "audit_event" DISABLE TRIGGER "audit_event_append_only"'),
      db.prisma.client.$executeRawUnsafe(
        `UPDATE "audit_event" SET "details" = '{"nummer": 99}' WHERE "id" = ${midden.id}`
      ),
      db.prisma.client.$executeRawUnsafe('ALTER TABLE "audit_event" ENABLE TRIGGER "audit_event_append_only"'),
    ]);

    const verificatie = await audit.verifieer(rm, taak.id);
    expect(verificatie.intact).toBe(false);
    expect(verificatie.fouten).toEqual([{ id: midden.id.toString(), reden: "hash" }]);
  });

  it("legt configuratie-events in één eigen keten vast", async () => {
    const actor = { type: "user" as const, user: gebruiker("fb1", "functioneel_beheerder"), rol: "functioneel_beheerder" as const };
    await Promise.all(
      [1, 2, 3].map((nummer) =>
        db.prisma.client.$transaction((tx) =>
          schrijfConfiguratieEvent(tx, actor, {
            actie: "MASTER_DATA_IMPORTED",
            entiteitType: "stamgegevens",
            entiteitId: "stamgegevens",
            details: { nummer },
          })
        )
      )
    );

    // Eén keten over alle configuratie-events (ook de USER_LINKED-events van eerdere tests).
    const events = await db.prisma.client.configuratieEvent.findMany({ orderBy: { id: "asc" } });
    expect(events.filter((event) => event.actie === "MASTER_DATA_IMPORTED")).toHaveLength(3);
    expect(events.map((event) => event.vorigeHash)).toEqual([null, ...events.slice(0, -1).map((event) => event.hash)]);
  });
});

describe("auditlog lezen", () => {
  it("pagineert in volgorde en is alleen zichtbaar voor betrokkenen en de auditor", async () => {
    const taak = await nieuweTaak();
    for (const nummer of [1, 2, 3]) {
      await schrijf(taak.id, nummer);
    }

    const pagina2 = await audit.getAuditlog(rm, taak.id, 2, 2);
    expect(pagina2).toMatchObject({ totaal: 3, pagina: 2, perPagina: 2 });
    expect(pagina2.items.map((item) => (item.details as { nummer: number }).nummer)).toEqual([3]);

    await expect(audit.getAuditlog(gebruiker("po1", "proceseigenaar"), taak.id)).resolves.toMatchObject({ totaal: 3 });
    await expect(audit.getAuditlog(gebruiker("auditor1", "auditor"), taak.id)).resolves.toMatchObject({ totaal: 3 });
    await expect(audit.getAuditlog(gebruiker("niemand", "recordmanager"), taak.id)).rejects.toThrow(NotFoundException);
    await expect(audit.verifieer(gebruiker("niemand", "recordmanager"), taak.id)).rejects.toThrow(NotFoundException);
  });
});

describe("databasebescherming (applicatierol)", () => {
  it("mag op audit_event alleen lezen en toevoegen", async () => {
    const taak = await nieuweTaak();
    await schrijf(taak.id, 1);

    await expect(app.query('SELECT count(*) FROM "audit_event"')).resolves.toBeTruthy();
    await expect(
      app.query(
        `INSERT INTO "audit_event" ("taakinstantie_id", "actor_type", "actie", "entiteit_type", "entiteit_id", "details", "hash")
         VALUES ($1::uuid, 'system', 'TASK_COMPLETED', 'taakinstantie', $2, '{}', 'x')`,
        [taak.id, taak.id]
      )
    ).resolves.toBeTruthy();

    for (const opdracht of [
      'UPDATE "audit_event" SET "actie" = \'X\'',
      'DELETE FROM "audit_event"',
      'TRUNCATE "audit_event"',
      'UPDATE "configuratie_event" SET "actie" = \'X\'',
      'TRUNCATE "configuratie_event"',
      'SELECT * FROM "_prisma_migrations"',
    ]) {
      await expect(app.query(opdracht), opdracht).rejects.toThrow(/permission denied/);
    }
  });

  it("kan de gewone tabellen wel wijzigen", async () => {
    const taak = await nieuweTaak();
    await expect(app.query('UPDATE "taakinstantie" SET "naam" = \'Hernoemd\' WHERE "id" = $1', [taak.id])).resolves.toMatchObject({
      rowCount: 1,
    });
  });

  it("weigert TRUNCATE ook voor de eigenaar", async () => {
    await expect(db.prisma.client.$executeRawUnsafe('TRUNCATE "audit_event"')).rejects.toThrow(/append-only/);
    await expect(db.prisma.client.$executeRawUnsafe('TRUNCATE "configuratie_event"')).rejects.toThrow(/append-only/);
  });
});

describe("migratie", () => {
  it("stopt als er al audit-events zijn", async () => {
    await expect(db.prisma.client.$executeRawUnsafe(migratieControle)).rejects.toThrow(/ADR-0003 vereist een lege database/);
  });
});
