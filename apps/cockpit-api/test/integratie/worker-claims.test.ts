import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { StekkerClient } from "../../src/modules/stekker/stekker-client.js";
import { SelectieWorkerService } from "../../src/modules/worker/selectie-worker.service.js";
import { WorkflowService } from "../../src/modules/workflow/workflow.service.js";
import { maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;

const wacht = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
});

beforeEach(async () => {
  // Geen open werk van eerdere tests.
  await db.prisma.client.outbox.updateMany({ where: { status: "OPEN" }, data: { status: "VERWERKT" } });
  await db.prisma.client.selectie.updateMany({ data: { status: "GEIMPORTEERD" } });
});

afterAll(async () => {
  await db?.stop();
});

// Trage nep-stekker die het aantal aanroepen telt; `tijdensStart` draait midden in de aanroep.
function nepStekker(opties: { vertragingMs?: number; tijdensStart?: () => Promise<void> } = {}) {
  const aanroepen = { startSelectie: 0, getSelectie: 0 };
  const client = {
    startSelectie: async () => {
      aanroepen.startSelectie += 1;
      await opties.tijdensStart?.();
      await wacht(opties.vertragingMs ?? 0);
      return { selectieId: `extern-${aanroepen.startSelectie}`, status: "RUNNING" };
    },
    getSelectie: async () => {
      aanroepen.getSelectie += 1;
      await wacht(opties.vertragingMs ?? 0);
      return { selectieId: "extern-1", status: "RUNNING" };
    },
  };
  return { client: client as unknown as StekkerClient, aanroepen };
}

function worker(id: string, stekker: StekkerClient, leaseMs = 60_000) {
  const config = new ConfigService({ WORKER_ID: id, WORKER_LEASE_MS: String(leaseMs) });
  return new SelectieWorkerService(db.prisma, config, stekker, new WorkflowService());
}

// Een taak met een aangevraagde selectie en een open selectie:start-job.
async function maakSelectieJob() {
  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "Claims",
      status: "init",
      recordmanagerId: basis.rm.id,
      proceseigenaarId: basis.po.id,
      archivarisId: basis.arch.id,
    },
  });
  const selectie = await client.selectie.create({
    data: {
      taakinstantieId: taak.id,
      stekkerId: basis.stekker.id,
      stekkerConfiguratieId: configuratie.id,
      status: "AANGEVRAAGD",
    },
  });
  const job = await client.outbox.create({
    data: {
      taakinstantieId: taak.id,
      queue: "selectie",
      jobNaam: "selectie:start",
      payload: { selectieId: selectie.id, peildatum: null },
    },
  });
  return { taak, selectie, job };
}

const leesJob = (id: string) => db.prisma.client.outbox.findUniqueOrThrow({ where: { id } });

describe("claimen van jobs", () => {
  it("twee workers tegelijk: de stekker krijgt de selectie één keer", async () => {
    const { job, selectie } = await maakSelectieJob();
    const stekker = nepStekker({ vertragingMs: 200 });

    await Promise.all([worker("a", stekker.client).verwerkRonde(), worker("b", stekker.client).verwerkRonde()]);

    expect(stekker.aanroepen.startSelectie).toBe(1);
    expect(await leesJob(job.id)).toMatchObject({ status: "VERWERKT", pogingen: 1, geclaimdDoor: null, geclaimdTot: null });
    expect(await db.prisma.client.selectie.findUniqueOrThrow({ where: { id: selectie.id } })).toMatchObject({
      externSelectieId: "extern-1",
      geclaimdDoor: null,
    });
  });

  it("slaat een job over zolang de lease van een andere worker loopt", async () => {
    const { job } = await maakSelectieJob();
    await db.prisma.client.outbox.update({
      where: { id: job.id },
      data: { geclaimdDoor: "andere", geclaimdTot: new Date(Date.now() + 60_000) },
    });
    const stekker = nepStekker();

    await worker("a", stekker.client).verwerkRonde();

    expect(stekker.aanroepen.startSelectie).toBe(0);
    expect(await leesJob(job.id)).toMatchObject({ status: "OPEN", geclaimdDoor: "andere" });
  });

  it("neemt een job over na een verlopen lease (worker gecrasht)", async () => {
    const { job } = await maakSelectieJob();
    await db.prisma.client.outbox.update({
      where: { id: job.id },
      data: { geclaimdDoor: "gecrasht", geclaimdTot: new Date(Date.now() - 1_000) },
    });
    const stekker = nepStekker();

    await worker("a", stekker.client).verwerkRonde();

    expect(stekker.aanroepen.startSelectie).toBe(1);
    expect(await leesJob(job.id)).toMatchObject({ status: "VERWERKT", geclaimdDoor: null });
  });

  it("legt niets vast als de claim tijdens het werk is overgenomen", async () => {
    const { job, selectie } = await maakSelectieJob();
    const stekker = nepStekker({
      // Bootst na dat de lease verliep en een andere worker de job overnam.
      tijdensStart: async () => {
        await db.prisma.client.outbox.update({ where: { id: job.id }, data: { geclaimdDoor: "overnemer" } });
      },
    });

    await worker("a", stekker.client).verwerkRonde();

    expect(await leesJob(job.id)).toMatchObject({ status: "OPEN", pogingen: 0, geclaimdDoor: "overnemer" });
    expect(await db.prisma.client.selectie.findUniqueOrThrow({ where: { id: selectie.id } })).toMatchObject({
      externSelectieId: null,
      status: "AANGEVRAAGD",
    });
  });
});

describe("claimen van polls", () => {
  it("twee workers pollen een lopende selectie één keer per ronde en geven de claim daarna vrij", async () => {
    const { job, selectie } = await maakSelectieJob();
    await db.prisma.client.outbox.update({ where: { id: job.id }, data: { status: "VERWERKT" } });
    await db.prisma.client.selectie.update({ where: { id: selectie.id }, data: { externSelectieId: "extern-1", status: "RUNNING" } });
    const stekker = nepStekker({ vertragingMs: 200 });

    await Promise.all([worker("a", stekker.client).verwerkRonde(), worker("b", stekker.client).verwerkRonde()]);

    expect(stekker.aanroepen.getSelectie).toBe(1);
    expect(await db.prisma.client.selectie.findUniqueOrThrow({ where: { id: selectie.id } })).toMatchObject({
      geclaimdDoor: null,
      geclaimdTot: null,
    });
  });
});
