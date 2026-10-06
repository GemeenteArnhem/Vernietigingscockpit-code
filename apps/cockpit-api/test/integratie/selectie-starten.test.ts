import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);
});

afterAll(async () => {
  await db?.stop();
});

describe("selectie starten", () => {
  it("weigert een recordmanager die niet aan de taak gekoppeld is", async () => {
    await expect(
      taken.selectie.startSelectie(gebruiker("iemand-anders", "recordmanager"), basis.taak.id, {})
    ).rejects.toThrow();
    expect(await db.prisma.client.selectie.count()).toBe(0);
  });

  it("schrijft selectie, outbox-job en audit-event samen", async () => {
    const resultaat = await taken.selectie.startSelectie(gebruiker("rm1", "recordmanager"), basis.taak.id, {
      peildatum: "2026-01-01",
    });
    const [selectieId] = resultaat.aangemaakteSelecties;

    const selectie = await db.prisma.client.selectie.findUniqueOrThrow({ where: { id: selectieId } });
    const outbox = await db.prisma.client.outbox.findMany({ where: { taakinstantieId: basis.taak.id } });
    const audit = await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: basis.taak.id } });

    expect(selectie.status).toBe("AANGEVRAAGD");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ jobNaam: "selectie:start", verzondenOp: null });
    expect((outbox[0].payload as { selectieId: string }).selectieId).toBe(selectieId);
    expect(audit.map((event) => event.actie)).toEqual(["SELECTION_REQUESTED"]);
  });

  it("weigert een tweede start zonder gefaalde stekker om te herkansen", async () => {
    await expect(
      taken.selectie.startSelectie(gebruiker("rm1", "recordmanager"), basis.taak.id, {})
    ).rejects.toThrow(/al gestart/);
    expect(await db.prisma.client.outbox.count({ where: { taakinstantieId: basis.taak.id } })).toBe(1);
  });
});
