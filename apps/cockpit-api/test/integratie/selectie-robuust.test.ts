import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StekkerFout, type StekkerClient } from "../../src/modules/stekker/stekker-client.js";
import { SelectieWorkerService } from "../../src/modules/worker/selectie-worker.service.js";
import { WorkflowService } from "../../src/modules/workflow/workflow.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";
import { mdtoKandidaat, stekkerKandidaat } from "./helpers/kandidaat.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;

const rm = gebruiker("rm1", "recordmanager");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);
});

beforeEach(async () => {
  // Geen lopend werk van eerdere tests.
  await db.prisma.client.outbox.updateMany({ where: { status: "OPEN" }, data: { status: "VERWERKT" } });
  await db.prisma.client.selectie.updateMany({
    where: { status: { in: ["AANGEVRAAGD", "RUNNING", "READY"] } },
    data: { status: "GEIMPORTEERD" },
  });
});

afterAll(async () => {
  await db?.stop();
});

type Antwoord = Error | { status: string };

// Nep-stekker: getSelectie geeft achtereenvolgens de opgegeven antwoorden; getKandidaten één pagina.
function nepStekker(antwoorden: Antwoord[] = [], kandidaten = 2) {
  const aanroepen = { getSelectie: 0 };
  const client = {
    getSelectie: async () => {
      aanroepen.getSelectie += 1;
      const antwoord = antwoorden.shift() ?? { status: "RUNNING" };
      if (antwoord instanceof Error) throw antwoord;
      return { selectieId: "extern", ...antwoord };
    },
    getKandidaten: async () => ({
      items: Array.from({ length: kandidaten }, (_, i) => stekkerKandidaat(`nieuw-${i}`, `bron-${i}`, `Nieuw ${i}`)),
      totaal: kandidaten,
    }),
  };
  return { client: client as unknown as StekkerClient, aanroepen };
}

function worker(stekker: StekkerClient) {
  const config = new ConfigService({ WORKER_MAX_POGINGEN: "3", WORKER_BACKOFF_START_MS: "1", WORKER_BACKOFF_MAX_MS: "5" });
  return new SelectieWorkerService(db.prisma, config, stekker, new WorkflowService());
}

async function maakTaak(selectie: { status: string; externSelectieId?: string; selectietijdstip?: Date; kandidaten?: number }) {
  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "Selectie",
      status: "init",
      recordmanagerId: basis.rm.id,
      proceseigenaarId: basis.po.id,
      archivarisId: basis.arch.id,
    },
  });
  const record = await client.selectie.create({
    data: {
      taakinstantieId: taak.id,
      stekkerId: basis.stekker.id,
      stekkerConfiguratieId: configuratie.id,
      status: selectie.status,
      externSelectieId: selectie.externSelectieId ?? "extern",
      selectietijdstip: selectie.selectietijdstip ?? new Date(),
      fout: selectie.status === "FAILED" ? "Eerdere fout" : null,
      kandidaten: {
        create: Array.from({ length: selectie.kandidaten ?? 0 }, (_, i) => ({
          ...mdtoKandidaat(`oud-${i}`, { kenmerk: `oud-bron-${i}`, naam: `Oud ${i}` }),
        })),
      },
    },
  });
  return { taak, selectie: record };
}

const leesSelectie = (id: string) => db.prisma.client.selectie.findUniqueOrThrow({ where: { id } });

describe("herkansen maakt een nieuw selectierecord", () => {
  it("bewaart de mislukte selectie met haar kandidaten als VERVANGEN en toont alleen de nieuwe", async () => {
    const { taak, selectie: oud } = await maakTaak({ status: "FAILED", kandidaten: 3 });

    const antwoord = await taken.selectie.startSelectie(rm, taak.id, { stekkerId: basis.stekker.id });
    const [nieuwId] = antwoord.aangemaakteSelecties;

    expect(nieuwId).not.toBe(oud.id);
    expect(await leesSelectie(oud.id)).toMatchObject({ status: "VERVANGEN", vervangenDoorId: nieuwId, fout: "Eerdere fout" });
    expect(await leesSelectie(nieuwId)).toMatchObject({ status: "AANGEVRAAGD", externSelectieId: null });
    expect(await db.prisma.client.vernietigingskandidaat.count({ where: { selectieId: oud.id } })).toBe(3);

    const weergave = await taken.selectie.getSelectie(rm, taak.id);
    expect(JSON.stringify(weergave)).toContain(nieuwId);
    expect(JSON.stringify(weergave)).not.toContain(oud.id);

    const job = await db.prisma.client.outbox.findFirstOrThrow({ where: { taakinstantieId: taak.id, jobNaam: "selectie:start" } });
    expect(job.payload).toMatchObject({ selectieId: nieuwId });
    const event = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, eventType: "Selectie opnieuw aangevraagd" } });
    expect(event).toMatchObject({ entiteitId: nieuwId });
    expect(event.details).toMatchObject({ vorigeSelectieId: oud.id, selectieId: nieuwId });
  });

  it("twee gelijktijdige herkansingen geven één nieuwe selectie", async () => {
    const { taak, selectie: oud } = await maakTaak({ status: "FAILED" });

    const uitkomsten = await Promise.allSettled([
      taken.selectie.startSelectie(rm, taak.id, { stekkerId: basis.stekker.id }),
      taken.selectie.startSelectie(rm, taak.id, { stekkerId: basis.stekker.id }),
    ]);

    expect(uitkomsten.filter((uitkomst) => uitkomst.status === "fulfilled")).toHaveLength(1);
    const selecties = await db.prisma.client.selectie.findMany({ where: { taakinstantieId: taak.id } });
    expect(selecties.filter((selectie) => selectie.status !== "VERVANGEN")).toHaveLength(1);
    expect(selecties.find((selectie) => selectie.id === oud.id)?.status).toBe("VERVANGEN");
  });

  it("telt kandidaten van de vervangen selectie niet mee; de taak gaat door na import van de nieuwe", async () => {
    const { taak, selectie: oud } = await maakTaak({ status: "FAILED", kandidaten: 3 });
    const { aangemaakteSelecties } = await taken.selectie.startSelectie(rm, taak.id, { stekkerId: basis.stekker.id });
    await db.prisma.client.selectie.update({ where: { id: aangemaakteSelecties[0] }, data: { status: "READY", externSelectieId: "extern" } });

    await worker(nepStekker([], 2).client).verwerkRonde();

    expect((await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taak.id } })).status).toBe("beoordeling");
    const { kandidaten } = await taken.beoordeling.getKandidaten(rm, taak.id);
    expect(kandidaten.map((kandidaat) => kandidaat.vernietigingskandidaatId).sort()).toEqual(["nieuw-0", "nieuw-1"]);
    expect((await leesSelectie(oud.id)).status).toBe("VERVANGEN");
  });

  it("de database staat geen twee actieve selecties per stekker toe, en VERVANGEN alleen met verwijzing", async () => {
    const { taak, selectie } = await maakTaak({ status: "RUNNING" });

    await expect(
      db.prisma.client.selectie.create({
        data: {
          taakinstantieId: taak.id,
          stekkerId: basis.stekker.id,
          stekkerConfiguratieId: selectie.stekkerConfiguratieId,
          status: "AANGEVRAAGD",
        },
      })
    ).rejects.toThrow();
    await expect(db.prisma.client.selectie.update({ where: { id: selectie.id }, data: { status: "VERVANGEN" } })).rejects.toThrow(
      /selectie_vervangen_met_verwijzing/
    );
  });
});

describe("haperende statusvraag", () => {
  it("tijdelijke fouten: selectie blijft lopen met backoff, en herstelt bij succes", async () => {
    const { selectie } = await maakTaak({ status: "RUNNING" });
    const stekker = nepStekker([new StekkerFout("HTTP 503", { tijdelijk: true, status: 503 }), { status: "RUNNING" }]);
    const w = worker(stekker.client);

    await w.verwerkRonde();
    const naFout = await leesSelectie(selectie.id);
    expect(naFout).toMatchObject({ status: "RUNNING", pollFouten: 1, fout: expect.stringMatching(/Status opvragen mislukt.*Nieuwe poging/) });
    expect(naFout.volgendePollOp).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 20));
    await w.verwerkRonde();
    expect(await leesSelectie(selectie.id)).toMatchObject({ status: "RUNNING", pollFouten: 0, volgendePollOp: null, fout: null });
  });

  it("slaat een selectie over zolang de volgende poging nog niet aan de beurt is", async () => {
    const { selectie } = await maakTaak({ status: "RUNNING" });
    await db.prisma.client.selectie.update({ where: { id: selectie.id }, data: { volgendePollOp: new Date(Date.now() + 60_000) } });
    const stekker = nepStekker();

    await worker(stekker.client).verwerkRonde();

    expect(stekker.aanroepen.getSelectie).toBe(0);
  });

  it("wordt FAILED na het maximum aantal fouten op rij", async () => {
    const { selectie } = await maakTaak({ status: "RUNNING" });
    const fout = () => new StekkerFout("time-out", { tijdelijk: true, code: "TIMEOUT" });
    const stekker = nepStekker([fout(), fout(), fout(), fout()]);
    const w = worker(stekker.client);

    for (let ronde = 0; ronde < 6; ronde += 1) {
      await w.verwerkRonde();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(stekker.aanroepen.getSelectie).toBe(3);
    expect(await leesSelectie(selectie.id)).toMatchObject({ status: "FAILED", pollFouten: 3, fout: expect.stringMatching(/na 3 pogingen/) });
  });

  it("een definitieve fout (404) maakt de selectie direct FAILED", async () => {
    const { selectie } = await maakTaak({ status: "RUNNING" });
    const stekker = nepStekker([new StekkerFout("HTTP 404", { tijdelijk: false, status: 404 })]);

    await worker(stekker.client).verwerkRonde();

    expect(await leesSelectie(selectie.id)).toMatchObject({ status: "FAILED", pollFouten: 1, fout: expect.stringMatching(/niet tijdelijk/) });
  });
});

describe("time-out per selectie", () => {
  it("maakt een te lang lopende selectie FAILED zonder de stekker te vragen (selectieMs uit de configuratie)", async () => {
    await db.prisma.client.stekkerConfiguratie.updateMany({
      where: { stekkerId: basis.stekker.id },
      data: { timeouts: { selectieMs: 3_600_000 } },
    });
    const { selectie } = await maakTaak({ status: "RUNNING", selectietijdstip: new Date(Date.now() - 2 * 3_600_000) });
    const stekker = nepStekker();

    await worker(stekker.client).verwerkRonde();

    expect(stekker.aanroepen.getSelectie).toBe(0);
    expect(await leesSelectie(selectie.id)).toMatchObject({ status: "FAILED", fout: expect.stringMatching(/niet binnen 1 uur.*time-out/) });
    await db.prisma.client.stekkerConfiguratie.updateMany({ where: { stekkerId: basis.stekker.id }, data: { timeouts: {} } });
  });

  it("gebruikt standaard 24 uur", async () => {
    const { selectie } = await maakTaak({ status: "RUNNING", selectietijdstip: new Date(Date.now() - 23 * 3_600_000) });

    await worker(nepStekker().client).verwerkRonde();

    expect((await leesSelectie(selectie.id)).status).toBe("RUNNING");
  });
});
