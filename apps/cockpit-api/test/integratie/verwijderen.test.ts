import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { verifieerTaakKeten } from "../../src/modules/audit/audit.service.js";
import { TaakdefinitiesService } from "../../src/modules/taakdefinities/taakdefinities.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

// De functioneel beheerder: alle taken zien, taken en uitvoeringen aanmaken (voor een gekozen
// recordmanager) en verwijderen. Het auditlog blijft append-only: uitvoeringen worden logisch
// verwijderd (TASK_DELETED); een taakdefinitie zonder uitvoeringen echt. Niet toegestaan vanaf
// de vernietiging tot en met de archivering, en niet tijdens een lopende selectie.

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let service: TaakdefinitiesService;
let taken: TaakServices;
const fb = gebruiker("fb1", "functioneel_beheerder");
const rm = gebruiker("rm1", "recordmanager");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  service = new TaakdefinitiesService(db.prisma, new CurrentMedewerkerService(db.prisma));
  taken = maakTaakServices(db);
});

afterAll(async () => {
  await db?.stop();
});

const definitie = (overrides: Record<string, unknown> = {}) => ({
  naam: `Taak ${Math.random().toString(36).slice(2, 7)}`,
  categorie: "Test",
  frequentie: "ad_hoc" as const,
  startmaand: null,
  recordmanagerId: basis.rm.id,
  proceseigenaarId: basis.po.id,
  archivarisId: basis.arch.id,
  stekkers: [{ stekkerId: basis.stekker.id, selectieparameters: {} }],
  ...overrides,
});

const zetStatus = (id: string, status: "uitvoering" | "resultaat" | "archief") =>
  db.prisma.client.taakinstantie.update({ where: { id }, data: { status } });

describe("beheerder maakt aan", () => {
  it("een taak voor een gekozen recordmanager, met functiescheiding, en een uitvoering daarvan", async () => {
    const aangemaakt = await service.createTaakdefinitie(fb, definitie());
    const event = await db.prisma.client.configuratieEvent.findFirstOrThrow({
      where: { entiteitId: aangemaakt.id, eventType: "Taakdefinitie aangemaakt" },
    });
    expect(event).toMatchObject({ rol: "functioneel_beheerder" });

    await expect(service.createTaakdefinitie(fb, definitie({ proceseigenaarId: basis.rm.id }))).rejects.toThrow(/Functiescheiding/);

    const uitvoering = await service.createTaakinstantie(fb, aangemaakt.id, {});
    expect(uitvoering).toMatchObject({ status: "init" });
    expect(await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: uitvoering.id } })).toMatchObject({
      eventType: "Creatie",
      rol: "functioneel_beheerder",
    });
  });

  it("ziet alle taken, ook die van andere recordmanagers", async () => {
    const aangemaakt = await service.createTaakdefinitie(fb, definitie());
    expect((await service.getTaakdefinities(fb, "alle")).map((item) => item.id)).toContain(aangemaakt.id);
  });
});

describe("beheerder verwijdert", () => {
  it("een taak zonder uitvoeringen: echt, met TASK_DEFINITION_DELETED", async () => {
    const aangemaakt = await service.createTaakdefinitie(fb, definitie());
    await service.verwijderTaakdefinitie(fb, aangemaakt.id);

    expect(await db.prisma.client.taakdefinitie.count({ where: { id: aangemaakt.id } })).toBe(0);
    expect(
      await db.prisma.client.configuratieEvent.findFirstOrThrow({ where: { entiteitId: aangemaakt.id, eventType: "Taakdefinitie verwijderd" } })
    ).toMatchObject({ details: expect.objectContaining({ echtVerwijderd: true }) });
  });

  it("een taak met uitvoeringen: logisch, uitvoeringen met TASK_DELETED, auditketen intact, nergens meer zichtbaar", async () => {
    const aangemaakt = await service.createTaakdefinitie(fb, definitie());
    const uitvoering = await service.createTaakinstantie(fb, aangemaakt.id, {});
    await service.verwijderTaakdefinitie(fb, aangemaakt.id);

    expect(await db.prisma.client.taakdefinitie.findUniqueOrThrow({ where: { id: aangemaakt.id } })).toMatchObject({
      verwijderdOp: expect.any(Date),
      actief: false,
    });
    expect((await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: uitvoering.id } })).verwijderdOp).toBeInstanceOf(Date);

    const acties = (await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: uitvoering.id }, orderBy: { id: "asc" } })).map(
      (event) => event.eventType
    );
    expect(acties).toEqual(["Creatie", "Logisch verwijderd"]);
    expect(await verifieerTaakKeten(db.prisma, uitvoering.id)).toMatchObject({ intact: true });

    expect((await service.getTaakdefinities(fb, "alle")).map((item) => item.id)).not.toContain(aangemaakt.id);
    await expect(taken.toegang.getTaak(rm, uitvoering.id)).rejects.toThrow();
    await expect(service.createTaakinstantie(fb, aangemaakt.id, {})).rejects.toThrow();
  });

  it("een uitvoering: niet vanaf de vernietiging tot de archivering; na archivering wel", async () => {
    const aangemaakt = await service.createTaakdefinitie(fb, definitie());
    const uitvoering = await service.createTaakinstantie(fb, aangemaakt.id, {});

    await zetStatus(uitvoering.id, "uitvoering");
    await expect(service.verwijderTaakinstantie(fb, aangemaakt.id, uitvoering.id)).rejects.toMatchObject({ status: 409 });
    await zetStatus(uitvoering.id, "resultaat");
    await expect(service.verwijderTaakinstantie(fb, aangemaakt.id, uitvoering.id)).rejects.toMatchObject({ status: 409 });
    // En dan ook de taak niet.
    await expect(service.verwijderTaakdefinitie(fb, aangemaakt.id)).rejects.toMatchObject({ status: 409 });

    await zetStatus(uitvoering.id, "archief");
    await service.verwijderTaakinstantie(fb, aangemaakt.id, uitvoering.id);
    expect((await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: uitvoering.id } })).verwijderdOp).toBeInstanceOf(Date);
    // De taak zelf blijft, zonder deze uitvoering.
    expect((await service.getTaakdefinitie(fb, aangemaakt.id)).instanties).toEqual([]);
  });

  it("niet tijdens een lopende selectie", async () => {
    const aangemaakt = await service.createTaakdefinitie(fb, definitie());
    const uitvoering = await service.createTaakinstantie(fb, aangemaakt.id, {});
    await taken.selectie.startSelectie(rm, uitvoering.id, {});

    await expect(service.verwijderTaakinstantie(fb, aangemaakt.id, uitvoering.id)).rejects.toThrow(/selectie loopt/);
  });
});
