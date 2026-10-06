import { ConflictException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { eersteStartdatum } from "../../src/modules/taakdefinities/planning.js";
import { TaakdefinitiesService } from "../../src/modules/taakdefinities/taakdefinities.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

// Terugkerende taken: bij het aanmaken van de taakdefinitie staat er meteen één geplande
// taakuitvoering klaar (status init, gepland_op), en de selectie kan pas vanaf die datum.

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let service: TaakdefinitiesService;
let taken: TaakServices;
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

const definitie = (frequentie: "jaarlijks" | "kwartaal" | "maandelijks" | "ad_hoc", startmaand: number | null) => ({
  naam: `Planning ${frequentie} ${Math.random().toString(36).slice(2, 7)}`,
  categorie: "Test",
  frequentie,
  startmaand,
  recordmanagerId: basis.rm.id,
  proceseigenaarId: basis.po.id,
  archivarisId: basis.arch.id,
  stekkers: [{ stekkerId: basis.stekker.id, selectieparameters: {} }],
});

const uitvoeringen = (taakdefinitieId: string) =>
  db.prisma.client.taakinstantie.findMany({ where: { taakdefinitieId }, orderBy: { naam: "asc" } });

describe("geplande taakuitvoering", () => {
  it("jaarlijks: één uitvoering in init op de 1e van de eerstvolgende startmaand, met TASK_CREATED", async () => {
    const startmaand = new Date().getUTCMonth() === 11 ? 1 : new Date().getUTCMonth() + 2; // volgende maand
    const aangemaakt = await service.createTaakdefinitie(rm, definitie("jaarlijks", startmaand));
    const [uitvoering, ...rest] = await uitvoeringen(aangemaakt.id);
    const verwacht = eersteStartdatum("jaarlijks", startmaand, new Date())!;

    expect(rest).toHaveLength(0);
    expect(uitvoering).toMatchObject({ status: "init", naam: `${aangemaakt.naam} ${verwacht.getUTCFullYear()}` });
    expect(uitvoering.geplandOp?.toISOString().slice(0, 10)).toBe(verwacht.toISOString().slice(0, 10));
    expect(uitvoering.peildatum?.toISOString().slice(0, 10)).toBe(verwacht.toISOString().slice(0, 10));

    const event = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: uitvoering.id } });
    expect(event).toMatchObject({ actie: "TASK_CREATED", actorType: "user" });
    expect(event.details).toMatchObject({ gepland: true });

    // Zolang de startdatum in de toekomst ligt: geen selectie (API 409), en de actie ontbreekt.
    const detail = await taken.toegang.getTaak(rm, uitvoering.id);
    expect(detail.taak.toegestaneActies).toEqual([]);
    expect(detail.taak.geplandOp).toBe(verwacht.toISOString());
    await expect(taken.selectie.startSelectie(rm, uitvoering.id, {})).rejects.toThrow(ConflictException);
  });

  it("vanaf de startdatum kan de selectie wel starten", async () => {
    const aangemaakt = await service.createTaakdefinitie(rm, definitie("maandelijks", null));
    const [uitvoering] = await uitvoeringen(aangemaakt.id);
    await db.prisma.client.taakinstantie.update({ where: { id: uitvoering.id }, data: { geplandOp: new Date(Date.now() - 86_400_000) } });

    expect((await taken.toegang.getTaak(rm, uitvoering.id)).taak.toegestaneActies).toEqual(["selectie.starten"]);
    expect(await taken.selectie.startSelectie(rm, uitvoering.id, {})).toMatchObject({ aangemaakteSelecties: [expect.any(String)] });
  });

  it("ad hoc: geen geplande uitvoering", async () => {
    const aangemaakt = await service.createTaakdefinitie(rm, definitie("ad_hoc", null));
    expect(await uitvoeringen(aangemaakt.id)).toHaveLength(0);
  });

  it("jaarlijks of kwartaal zonder startmaand: 400", async () => {
    await expect(service.createTaakdefinitie(rm, definitie("kwartaal", null))).rejects.toThrow(/startmaand/);
  });

  it("de database staat maar één geplande, niet gestarte uitvoering per definitie toe", async () => {
    const aangemaakt = await service.createTaakdefinitie(rm, definitie("kwartaal", 1));
    const [uitvoering] = await uitvoeringen(aangemaakt.id);

    await expect(
      db.prisma.client.taakinstantie.create({
        data: {
          taakdefinitieId: aangemaakt.id,
          naam: "Dubbel",
          status: "init",
          geplandOp: uitvoering.geplandOp,
          recordmanagerId: basis.rm.id,
          proceseigenaarId: basis.po.id,
          archivarisId: basis.arch.id,
        },
      })
    ).rejects.toThrow();
  });
});
