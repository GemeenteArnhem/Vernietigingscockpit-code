import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm as rm_, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { schrijfAuditEvent } from "../../src/modules/audit/audit-keten.js";
import { StekkerFout, type StekkerClient, type StekkerUitvoeringsresultaat } from "../../src/modules/stekker/stekker-client.js";
import { berekenLijstHash } from "../../src/modules/taken/taken-hulp.js";
import { SelectieWorkerService } from "../../src/modules/worker/selectie-worker.service.js";
import { WorkflowService } from "../../src/modules/workflow/workflow.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;

const rm = gebruiker("rm1", "recordmanager");
const wacht = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);
  // Kleine batches, zodat 25 kandidaten 3 batches geven.
  await db.prisma.client.stekkerConfiguratie.updateMany({
    where: { stekkerId: basis.stekker.id },
    data: { parameters: { batchGrootte: 10 } },
  });
});

beforeEach(async () => {
  // Geen open werk van eerdere tests.
  await db.prisma.client.outbox.updateMany({ where: { status: "OPEN" }, data: { status: "VERWERKT" } });
  await db.prisma.client.vernietiging.updateMany({ where: { status: "LOPEND" }, data: { status: "AFGEROND" } });
});

afterAll(async () => {
  await db?.stop();
});

// ---------------------------------------------------------------------------------------
// Nagebootste stekker met geheugen en Idempotency-Keys, zoals de echte teststekker.
// `onderbreek` draait NA de verwerking: een fout betekent "verwerkt, maar antwoord kwijt",
// "hang" betekent "worker gecrasht tijdens de aanroep" (de aanroep komt nooit terug).

type Stap = "start" | "batch" | "vrijgeven" | "status" | "resultaten";
type Onderbreking = Error | "hang" | undefined;

function nepStekker(opties: {
  onderbreek?: (stap: Stap, details: { batchNummer?: number; aanroep: number }) => Onderbreking;
  resultaten?: (objecten: Array<{ vernietigingskandidaatId: string; bronId: string; batchNummer: number }>) => StekkerUitvoeringsresultaat[];
  eindstatus?: "COMPLETED" | "PARTIAL" | "FAILED";
  // Elke aanroep duurt zo lang (een trage stekker).
  vertragingMs?: number;
} = {}) {
  const perSleutel = new Map<string, unknown>();
  const vernietigingen = new Map<string, { batches: Map<number, Array<{ vernietigingskandidaatId: string; bronId: string }>>; vrijgegeven: boolean }>();
  const aanroepen: Record<Stap, number> = { start: 0, batch: 0, vrijgeven: 0, status: 0, resultaten: 0 };
  let bereikt: () => void = () => undefined;
  const hangBereikt = new Promise<void>((resolve) => (bereikt = resolve));

  async function na<T>(stap: Stap, waarde: T, batchNummer?: number): Promise<T> {
    if (opties.vertragingMs) {
      await wacht(opties.vertragingMs);
    }
    const onderbreking = opties.onderbreek?.(stap, { batchNummer, aanroep: aanroepen[stap] });
    if (onderbreking === "hang") {
      bereikt();
      return new Promise<T>(() => undefined);
    }
    if (onderbreking) {
      throw onderbreking;
    }
    return waarde;
  }

  function idempotent<T>(sleutel: string, maak: () => T): T {
    if (!perSleutel.has(sleutel)) {
      perSleutel.set(sleutel, maak());
    }
    return perSleutel.get(sleutel) as T;
  }

  const client = {
    startVernietiging: async (_v: unknown, body: { selectieId: string }, sleutel: string) => {
      aanroepen.start += 1;
      const antwoord = idempotent(sleutel, () => {
        const id = `vern-${vernietigingen.size + 1}`;
        vernietigingen.set(id, { batches: new Map(), vrijgegeven: false });
        return { vernietigingId: id, selectieId: body.selectieId, status: "IDLE" };
      });
      return na("start", antwoord);
    },
    voegBatchToe: async (_v: unknown, id: string, body: { batchNummer: number; objecten: Array<{ vernietigingskandidaatId: string; bronId: string }> }, sleutel: string) => {
      aanroepen.batch += 1;
      idempotent(sleutel, () => vernietigingen.get(id)!.batches.set(body.batchNummer, body.objecten));
      return na("batch", { batchNummer: body.batchNummer, resultaten: [] }, body.batchNummer);
    },
    geefVrij: async (_v: unknown, id: string) => {
      aanroepen.vrijgeven += 1;
      vernietigingen.get(id)!.vrijgegeven = true;
      return na("vrijgeven", { vernietigingId: id, selectieId: "x", status: "RUNNING" });
    },
    getVernietiging: async (_v: unknown, id: string) => {
      aanroepen.status += 1;
      const klaar = vernietigingen.get(id)!.vrijgegeven;
      return na("status", { vernietigingId: id, selectieId: "x", status: klaar ? (opties.eindstatus ?? "COMPLETED") : "RUNNING" });
    },
    getBatchResultaten: async (_v: unknown, id: string) => {
      aanroepen.resultaten += 1;
      const batches = [...vernietigingen.get(id)!.batches.entries()].sort(([a], [b]) => a - b);
      const objecten = batches.flatMap(([batchNummer, items]) => items.map((item) => ({ ...item, batchNummer })));
      const resultaten =
        opties.resultaten?.(objecten) ?? objecten.map((object) => ({ ...object, resultaat: "SUCCESS" as const }));
      return na("resultaten", batches.map(([batchNummer]) => ({ batchNummer, resultaten: resultaten.filter((r) => r.batchNummer === batchNummer) })));
    },
  };

  return { client: client as unknown as StekkerClient, aanroepen, vernietigingen, hangBereikt };
}

function worker(id: string, stekker: StekkerClient, leaseMs = 60_000, extra: Record<string, string> = {}) {
  const config = new ConfigService({
    ...extra,
    WORKER_ID: id,
    WORKER_LEASE_MS: String(leaseMs),
    WORKER_MAX_POGINGEN: "3",
    WORKER_BACKOFF_START_MS: "1",
    WORKER_BACKOFF_MAX_MS: "5",
    WORKER_POLL_START_MS: "1",
    WORKER_POLL_MAX_MS: "5",
  });
  return new SelectieWorkerService(db.prisma, config, stekker, new WorkflowService());
}

// Taak in 'vrijgegeven' met `aantal` akkoord-kandidaten, en de vernietigingsopdracht gegeven.
async function maakOpdracht(aantal = 25) {
  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "Uitvoering",
      status: "vrijgegeven",
      recordmanagerId: basis.rm.id,
      proceseigenaarId: basis.po.id,
      archivarisId: basis.arch.id,
    },
  });
  await client.selectie.create({
    data: {
      taakinstantieId: taak.id,
      stekkerId: basis.stekker.id,
      stekkerConfiguratieId: configuratie.id,
      externSelectieId: "sel-extern",
      status: "GEIMPORTEERD",
      kandidaten: {
        create: Array.from({ length: aantal }, (_, i) => ({
          kandidaatId: `vk-${String(i).padStart(3, "0")}`,
          bronId: `bron-${i}`,
          omschrijving: `Zaak ${i}`,
          bron: {},
          beoordeling: "AKKOORD",
        })),
      },
    },
  });
  await client.$transaction((tx) =>
    schrijfAuditEvent(tx, { type: "user", user: gebruiker("arch1", "archivaris"), rol: "archivaris" }, {
      taakinstantieId: taak.id,
      actie: "DESTRUCTION_APPROVED_BY_ARCHIVIST",
      entiteitType: "taakinstantie",
      entiteitId: taak.id,
      details: {},
    })
  );
  // Zoals bij de vrijgave door de archivaris: de vingerafdruk van de lijst vastleggen.
  await client.taakinstantie.update({ where: { id: taak.id }, data: { lijstHash: await berekenLijstHash(client, taak.id) } });
  await taken.uitvoering.vernietigingsopdracht(rm, taak.id, taak.versie);
  const vernietiging = await client.vernietiging.findFirstOrThrow({ where: { taakinstantieId: taak.id } });
  return { taak, vernietiging };
}

const leesVernietiging = (id: string) => db.prisma.client.vernietiging.findUniqueOrThrow({ where: { id } });
const leesTaak = (id: string) => db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id } });

async function draaiTot(workers: SelectieWorkerService[], klaar: () => Promise<boolean>, maxRondes = 60) {
  for (let ronde = 0; ronde < maxRondes; ronde += 1) {
    for (const w of workers) {
      await w.verwerkRonde();
    }
    if (await klaar()) {
      return;
    }
    await wacht(10);
  }
  throw new Error("Niet klaar binnen het maximum aantal rondes.");
}

const afgerond = (vernietigingId: string) => async () =>
  (await leesVernietiging(vernietigingId)).status !== "LOPEND";

// Controle van het eindbeeld: één vernietiging, elke batch één keer, elk resultaat één keer.
async function controleerEindbeeld(taakId: string, vernietigingId: string, stekker: ReturnType<typeof nepStekker>, aantal = 25) {
  expect(stekker.vernietigingen.size).toBe(1);
  const [{ batches }] = [...stekker.vernietigingen.values()];
  expect([...batches.keys()]).toEqual([1, 2, 3]);
  expect([...batches.values()].flat()).toHaveLength(aantal);

  const regels = await db.prisma.client.uitvoeringsresultaat.findMany({ where: { vernietigingId } });
  expect(regels).toHaveLength(aantal);
  expect(regels.every((regel) => regel.resultaat === "SUCCESS")).toBe(true);

  const acties = (await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: taakId } })).map((e) => e.actie);
  expect(acties.filter((a) => a === "OBJECT_PROCESSED")).toHaveLength(aantal);
  expect(acties.filter((a) => a === "BATCH_STARTED")).toHaveLength(3);
  expect(acties.filter((a) => a === "BATCH_COMPLETED")).toHaveLength(3);
  expect(acties.filter((a) => a === "EXECUTION_STARTED")).toHaveLength(1);
  expect((await leesTaak(taakId)).status).toBe("resultaat");
}

// ---------------------------------------------------------------------------------------

describe("vernietigingsopdracht", () => {
  it("legt vooraf vaste batches en een resultaatregel per kandidaat vast", async () => {
    const { vernietiging } = await maakOpdracht(25);

    const batches = await db.prisma.client.vernietigingBatch.findMany({
      where: { vernietigingId: vernietiging.id },
      orderBy: { batchNummer: "asc" },
      include: { resultaten: { include: { kandidaat: { select: { kandidaatId: true } } } } },
    });
    expect(batches.map((batch) => batch.aantal)).toEqual([10, 10, 5]);
    expect(batches[0].resultaten.map((r) => r.kandidaat.kandidaatId).sort()[0]).toBe("vk-000");
    expect(batches.flatMap((batch) => batch.resultaten).every((r) => r.resultaat === null)).toBe(true);
    expect(vernietiging).toMatchObject({ status: "LOPEND", batchGrootte: 10, aantalKandidaten: 25 });
    expect(vernietiging.besluitReferentie).toMatch(/^audit-event:\d+$/);
  });
});

describe("uitvoering in stappen", () => {
  it("doorloopt start, batches, vrijgeven en resultaten, en rondt de taak af", async () => {
    const { taak, vernietiging } = await maakOpdracht();
    const stekker = nepStekker();

    await draaiTot([worker("a", stekker.client)], afgerond(vernietiging.id));

    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "AFGEROND", stekkerStatus: "COMPLETED", fout: null });
    expect(stekker.aanroepen).toMatchObject({ start: 1, batch: 3, vrijgeven: 1, resultaten: 1 });
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
  });

  // Scenario C: de stekker verwerkt het verzoek, maar het antwoord gaat verloren.
  it("doet niets dubbel als antwoorden op batches en vrijgeven verloren gaan", async () => {
    const { taak, vernietiging } = await maakOpdracht();
    const kwijt = () => new StekkerFout("HTTP 503 (antwoord kwijt)", { tijdelijk: true, status: 503 });
    const stekker = nepStekker({
      onderbreek: (stap, { batchNummer, aanroep }) =>
        (stap === "batch" && batchNummer === 2 && aanroep === 2) || (stap === "vrijgeven" && aanroep === 1) ? kwijt() : undefined,
    });

    await draaiTot([worker("a", stekker.client)], afgerond(vernietiging.id));

    expect(stekker.aanroepen).toMatchObject({ start: 1, batch: 4, vrijgeven: 2 });
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
  });

  // Een worker crasht midden in een stap; na de lease neemt een andere worker het over.
  it.each([
    ["start", (stap: Stap) => stap === "start"],
    ["tweede batch", (stap: Stap, batchNummer?: number) => stap === "batch" && batchNummer === 2],
    ["vrijgeven", (stap: Stap) => stap === "vrijgeven"],
    ["resultaten ophalen", (stap: Stap) => stap === "resultaten"],
  ])("gecrashte worker bij %s: geen dubbele batches en resultaten", async (_naam, crashBij) => {
    const { taak, vernietiging } = await maakOpdracht();
    let gecrasht = false;
    const stekker = nepStekker({
      onderbreek: (stap, { batchNummer }) => {
        if (!gecrasht && crashBij(stap, batchNummer)) {
          gecrasht = true;
          return "hang";
        }
        return undefined;
      },
    });
    const a = worker("a", stekker.client, 200);
    const b = worker("b", stekker.client, 200);

    // Worker a loopt tot de crash en komt daarna nooit meer terug.
    void (async () => {
      for (;;) {
        await a.verwerkRonde();
        await wacht(5);
      }
    })();
    await stekker.hangBereikt;
    await wacht(250); // lease verlopen

    await draaiTot([b], afgerond(vernietiging.id));

    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "AFGEROND" });
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
  });
});

describe("integriteitscontrole", () => {
  it("houdt de taak in uitvoering als een kandidaat geen resultaat heeft; na opnieuw proberen gaat het verder", async () => {
    const { taak, vernietiging } = await maakOpdracht();
    let onvolledig = true;
    const stekker = nepStekker({
      resultaten: (objecten) =>
        objecten
          .filter((object, index) => !onvolledig || index > 0)
          .map((object) => ({ ...object, resultaat: "SUCCESS" as const })),
    });
    const w = worker("a", stekker.client);

    await draaiTot([w], afgerond(vernietiging.id));

    expect(await leesVernietiging(vernietiging.id)).toMatchObject({
      status: "INTEGRITEIT_MISLUKT",
      fout: expect.stringMatching(/INTEGRITY_CHECK_FAILED.*1 van 25 kandidaten zonder resultaat/),
    });
    expect((await leesTaak(taak.id)).status).toBe("uitvoering");
    const uitvoering = await taken.uitvoering.getUitvoering(rm, taak.id);
    expect(uitvoering.stekkers[0]).toMatchObject({ vernietigingStatus: "MISLUKT", toegestaneActies: ["vernietiging.opnieuw"] });
    const mislukt = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, actie: "EXECUTION_FAILED" } });
    expect(mislukt.details).toMatchObject({ reden: "INTEGRITY_CHECK_FAILED" });

    // Stekker levert nu wel alles; opnieuw proberen vraagt alleen de resultaten opnieuw op.
    onvolledig = false;
    await taken.uitvoering.vernietigingOpnieuw(rm, taak.id, basis.stekker.id);
    await draaiTot([w], afgerond(vernietiging.id));

    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "AFGEROND" });
    expect(stekker.aanroepen).toMatchObject({ start: 1, batch: 3, vrijgeven: 1, resultaten: 2 });
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
  });

  it("weigert resultaten voor onbekende of dubbel gemelde kandidaten", async () => {
    const { vernietiging } = await maakOpdracht();
    const stekker = nepStekker({
      resultaten: (objecten) => [
        ...objecten.map((object) => ({ ...object, resultaat: "SUCCESS" as const })),
        { ...objecten[0], resultaat: "SUCCESS" as const },
        { vernietigingskandidaatId: "onbekend", bronId: "x", batchNummer: 1, resultaat: "SUCCESS" as const },
      ],
    });

    await draaiTot([worker("a", stekker.client)], afgerond(vernietiging.id));

    const na = await leesVernietiging(vernietiging.id);
    expect(na.status).toBe("INTEGRITEIT_MISLUKT");
    expect(na.fout).toMatch(/onbekende kandidaat onbekend/);
    expect(na.fout).toMatch(/meer dan één resultaat/);
  });
});

describe("retrybeleid en opnieuw proberen", () => {
  it("een definitieve fout (403) bij de start: 1 aanroep, MISLUKT; opnieuw proberen maakt het af", async () => {
    const { taak, vernietiging } = await maakOpdracht();
    let geweigerd = true;
    const stekker = nepStekker({
      onderbreek: (stap) =>
        stap === "start" && geweigerd ? new StekkerFout("POST /vernietigingen: HTTP 403 FORBIDDEN.", { tijdelijk: false, status: 403 }) : undefined,
    });
    const w = worker("a", stekker.client);

    await draaiTot([w], afgerond(vernietiging.id));

    expect(stekker.aanroepen.start).toBe(1);
    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "MISLUKT", fout: expect.stringMatching(/niet tijdelijk/) });
    expect((await leesTaak(taak.id)).status).toBe("uitvoering");

    const alsPo = await taken.uitvoering.getUitvoering(gebruiker("po1", "proceseigenaar"), taak.id);
    expect(alsPo.stekkers[0].toegestaneActies).toEqual([]);
    await expect(taken.uitvoering.vernietigingOpnieuw(gebruiker("po1", "recordmanager"), taak.id, basis.stekker.id)).rejects.toThrow();

    geweigerd = false;
    await taken.uitvoering.vernietigingOpnieuw(rm, taak.id, basis.stekker.id);
    await expect(taken.uitvoering.vernietigingOpnieuw(rm, taak.id, basis.stekker.id)).rejects.toThrow(/mislukt/);
    await draaiTot([w], afgerond(vernietiging.id));

    // De Idempotency-Key is gelijk gebleven: bij de stekker één vernietiging.
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
    const acties = (await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: taak.id }, orderBy: { id: "asc" } })).map(
      (event) => event.actie
    );
    expect(acties.indexOf("EXECUTION_FAILED")).toBeLessThan(acties.indexOf("EXECUTION_RETRY_REQUESTED"));
  });

  it("geeft het op na het maximum aantal tijdelijke fouten", async () => {
    const { vernietiging } = await maakOpdracht();
    const stekker = nepStekker({
      onderbreek: (stap) => (stap === "batch" ? new StekkerFout("time-out", { tijdelijk: true, code: "TIMEOUT" }) : undefined),
    });

    await draaiTot([worker("a", stekker.client)], afgerond(vernietiging.id));

    expect(stekker.aanroepen.batch).toBe(3);
    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "MISLUKT", fout: expect.stringMatching(/na 3 pogingen/) });
  });

  it("een stekker die FAILED meldt, levert vastgelegde resultaten op en rondt af", async () => {
    const { taak, vernietiging } = await maakOpdracht();
    const stekker = nepStekker({
      eindstatus: "FAILED",
      resultaten: (objecten) => objecten.map((object) => ({ ...object, resultaat: "FAILED" as const, foutmelding: "Bron weigert" })),
    });

    await draaiTot([worker("a", stekker.client)], afgerond(vernietiging.id));

    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "AFGEROND", stekkerStatus: "FAILED" });
    const resultaten = await taken.uitvoering.getVernietigingsresultaten(rm, taak.id);
    expect(new Set(resultaten.resultaten.map((r) => r.vernietigingsstatus))).toEqual(new Set(["FAILED"]));
    expect((await leesTaak(taak.id)).status).toBe("resultaat");
  });
});

describe("lease bij trage stappen (scenario F)", () => {
  it("een stap met meerdere trage aanroepen, langer dan de lease, wordt door twee workers één keer afgemaakt", async () => {
    // Elke aanroep 150 ms, lease 250 ms: een poll-ronde (status + resultaten) en de batchstap
    // (3 batches) duren langer dan de lease. Zonder verlenging nemen de workers elkaars claim
    // eindeloos over; met verlenging maakt één worker de stap af.
    const stekker = nepStekker({ vertragingMs: 150 });
    const { taak, vernietiging } = await maakOpdracht();
    const workers = [worker("a", stekker.client, 250), worker("b", stekker.client, 250)];

    // Beide workers draaien los van elkaar door, zoals twee worker-processen.
    const tot = Date.now() + 20_000;
    let klaar = false;
    await Promise.all(
      workers.map(async (w) => {
        while (!klaar && Date.now() < tot) {
          await w.verwerkRonde();
          klaar = await afgerond(vernietiging.id)();
          await wacht(5);
        }
      })
    );

    // Geen overgenomen en weggegooid werk: de resultaten één keer opgehaald, elke batch één keer.
    expect(stekker.aanroepen.resultaten).toBe(1);
    expect(stekker.aanroepen.batch).toBe(3);
    expect((await leesVernietiging(vernietiging.id)).status).toBe("AFGEROND");
    expect((await leesTaak(taak.id)).status).toBe("resultaat");
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------
// Vernietigingsverklaring (CC-17): de worker maakt hem bij de overgang naar resultaat.

// Nagebootste Gotenberg: bewaart de verzoeken en antwoordt met een (nep-)PDF of een fout.
async function nepGotenberg(antwoorden: number[] = []) {
  const verzoeken: string[] = [];
  const server = http.createServer((request, response) => {
    const delen: Buffer[] = [];
    request.on("data", (deel: Buffer) => delen.push(deel));
    request.on("end", () => {
      verzoeken.push(Buffer.concat(delen).toString("utf8"));
      const status = antwoorden.shift() ?? 200;
      response.writeHead(status, { "content-type": status === 200 ? "application/pdf" : "text/plain" });
      response.end(status === 200 ? "%PDF-1.7 nep" : "documentinhoud die niet in een fout mag");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, verzoeken, stop: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

describe("vernietigingsverklaring via de worker (CC-17)", () => {
  it("wordt bij de overgang naar resultaat automatisch gemaakt, als PDF/A-2b, door het systeem", async () => {
    const gotenberg = await nepGotenberg();
    try {
      const { taak, vernietiging } = await maakOpdracht();
      const w = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenberg.url });

      await draaiTot([w], afgerond(vernietiging.id));
      await w.verwerkRonde();

      const verklaring = await db.prisma.client.verklaring.findFirstOrThrow({ where: { taakinstantieId: taak.id } });
      expect(verklaring).toMatchObject({ versie: 1, status: "gegenereerd", gegenereerdDoor: "systeem" });
      expect(Buffer.from(verklaring.pdf).toString()).toBe("%PDF-1.7 nep");
      expect(verklaring.metadata).toMatchObject({
        tellingen: { aangeboden: 25, success: 25, uitgesloten: 0 },
        integriteit: { auditlog: { intact: true } },
      });
      expect(gotenberg.verzoeken[0]).toMatch(/name="pdfa"\r\n\r\nPDF\/A-2b/);
      expect(gotenberg.verzoeken[0]).toContain("Vernietigingsverklaring");

      const event = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, actie: "CERTIFICATE_GENERATED" } });
      expect(event).toMatchObject({ actorType: "system", entiteitId: verklaring.id });
      expect(await db.prisma.client.outbox.findFirstOrThrow({ where: { taakinstantieId: taak.id, queue: "verklaring" } })).toMatchObject({
        status: "VERWERKT",
        pogingen: 1,
      });

      // De API levert de opgeslagen versie.
      expect(await taken.dossier.getVerklaring(rm, taak.id)).toMatchObject({ beschikbaar: true, versie: 1 });
    } finally {
      await gotenberg.stop();
    }
  });

  it("probeert opnieuw als Gotenberg even niet beschikbaar is, zonder documentinhoud in de fout", async () => {
    const gotenberg = await nepGotenberg([503]);
    try {
      const { taak, vernietiging } = await maakOpdracht();
      const w = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenberg.url });
      // In dezelfde ronde als de overgang naar resultaat: eerste poging, Gotenberg geeft 503.
      await draaiTot([w], afgerond(vernietiging.id));
      const job = await db.prisma.client.outbox.findFirstOrThrow({ where: { taakinstantieId: taak.id, queue: "verklaring" } });
      expect(job).toMatchObject({ status: "OPEN", pogingen: 1, laatsteFout: expect.stringMatching(/Gotenberg is mislukt met status 503/) });
      expect(job.laatsteFout).not.toContain("documentinhoud");
      expect(await db.prisma.client.verklaring.count({ where: { taakinstantieId: taak.id } })).toBe(0);

      await wacht(20);
      await w.verwerkRonde();
      expect(await db.prisma.client.verklaring.count({ where: { taakinstantieId: taak.id } })).toBe(1);
      expect(await db.prisma.client.outbox.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: "VERWERKT", pogingen: 2 });
      expect(gotenberg.verzoeken).toHaveLength(2);
    } finally {
      await gotenberg.stop();
    }
  });

  it("is tijdens de uitvoering nog niet beschikbaar; opnieuw maken is een beheeractie", async () => {
    const gotenberg = await nepGotenberg();
    try {
      const { taak, vernietiging } = await maakOpdracht();
      expect(await taken.dossier.getVerklaring(rm, taak.id)).toEqual({ beschikbaar: false, status: "uitvoering-loopt" });
      await expect(taken.dossier.verklaringOpnieuw(taak.id)).rejects.toThrow(/pas worden gemaakt/);

      const w = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenberg.url });
      await draaiTot([w], afgerond(vernietiging.id));
      await w.verwerkRonde();
      await taken.dossier.verklaringOpnieuw(taak.id);
      await w.verwerkRonde();

      const versies = await db.prisma.client.verklaring.findMany({ where: { taakinstantieId: taak.id }, orderBy: { versie: "asc" } });
      expect(versies.map((versie) => versie.versie)).toEqual([1, 2]);
    } finally {
      await gotenberg.stop();
    }
  });
});

// ---------------------------------------------------------------------------------------
// Archivering (CC-18): de recordmanager vraagt het aan, de worker zet het dossier weg.

async function taakMetVerklaring(gotenbergUrl: string, archiefPad: string) {
  const { taak, vernietiging } = await maakOpdracht();
  const w = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenbergUrl, ARCHIEF_PAD: archiefPad });
  await draaiTot([w], afgerond(vernietiging.id));
  await w.verwerkRonde();
  expect(await db.prisma.client.verklaring.count({ where: { taakinstantieId: taak.id } })).toBe(1);
  return { taak, w };
}

describe("archivering (CC-18)", () => {
  it("zet verklaring, bijlage, auditlog en manifest weg en rondt de taak af", async () => {
    const gotenberg = await nepGotenberg();
    const archief = await mkdtemp(path.join(tmpdir(), "archief-"));
    try {
      const { taak: begin, vernietiging } = await maakOpdracht();
      // Zonder verklaring kan archiveren nog niet.
      await expect(taken.dossier.archiveren(rm, begin.id, (await leesTaak(begin.id)).versie)).rejects.toThrow();

      const w = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenberg.url, ARCHIEF_PAD: archief });
      await draaiTot([w], afgerond(vernietiging.id));
      await w.verwerkRonde();

      const voor = await taken.uitvoering.getVernietigingsresultaten(rm, begin.id);
      expect(voor.taak.toegestaneActies).toEqual(["archiveren"]);

      const aanvraag = await taken.dossier.archiveren(rm, begin.id, voor.taak.versie);
      expect(aanvraag.status).toBe("PENDING");
      // Een tweede aanvraag terwijl de eerste loopt: 409.
      await expect(taken.dossier.archiveren(rm, begin.id, voor.taak.versie)).rejects.toThrow(/loopt al/);
      expect((await taken.uitvoering.getVernietigingsresultaten(rm, begin.id)).taak.toegestaneActies).toEqual([]);

      await w.verwerkRonde();

      const taak = await leesTaak(begin.id);
      expect(taak.status).toBe("archief");
      const { archivering } = await taken.dossier.getArchivering(rm, begin.id);
      expect(archivering).toMatchObject({ status: "SUCCESS", adapter: "bestand", fout: null });

      const map = path.join(archief, begin.id, aanvraag.id);
      expect(archivering!.locatie).toBe(map);
      const manifestTekst = await readFile(path.join(map, "manifest.json"));
      expect(createHash("sha256").update(manifestTekst).digest("hex")).toBe(archivering!.manifestSha256);
      const manifest = JSON.parse(manifestTekst.toString("utf8"));
      expect(manifest).toMatchObject({
        soort: "vernietigingsdossier",
        taak: { id: begin.id },
        verklaring: { versie: 1, pdfa: "PDF/A-2b" },
        auditlog: { intact: true },
      });
      for (const bestand of manifest.bestanden as { naam: string; sha256: string }[]) {
        const inhoud = await readFile(path.join(map, bestand.naam));
        expect(createHash("sha256").update(inhoud).digest("hex")).toBe(bestand.sha256);
      }
      expect(manifest.bestanden.map((bestand: { naam: string }) => bestand.naam)).toEqual(["verklaring.pdf", "bijlage.csv", "auditlog.json"]);

      const events = await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: begin.id }, orderBy: { id: "asc" } });
      const acties = events.map((event) => event.actie);
      expect(acties.indexOf("ARCHIVING_REQUESTED")).toBeLessThan(acties.indexOf("TASK_COMPLETED"));
      expect(events.find((event) => event.actie === "ARCHIVING_REQUESTED")).toMatchObject({ actorType: "user" });
      expect(events.find((event) => event.actie === "TASK_COMPLETED")).toMatchObject({
        actorType: "system",
        details: expect.objectContaining({ archiveringId: aanvraag.id, manifestSha256: archivering!.manifestSha256 }),
      });
      // Na archief is er niets meer te archiveren.
      await expect(taken.dossier.archiveren(rm, begin.id, taak.versie)).rejects.toThrow();
    } finally {
      await gotenberg.stop();
      await rm_(archief, { recursive: true, force: true });
    }
  });

  it("legt een mislukte archivering vast; daarna kan de recordmanager opnieuw archiveren", async () => {
    const gotenberg = await nepGotenberg();
    const archief = await mkdtemp(path.join(tmpdir(), "archief-"));
    // Een bestand op de plek van de archiefmap: wegschrijven mislukt.
    const geblokkeerd = path.join(archief, "bestand");
    await writeFile(geblokkeerd, "geen map");
    try {
      const { taak: begin } = await taakMetVerklaring(gotenberg.url, geblokkeerd);
      const kapot = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenberg.url, ARCHIEF_PAD: geblokkeerd });

      const eerste = await taken.dossier.archiveren(rm, begin.id, (await leesTaak(begin.id)).versie);
      for (let ronde = 0; ronde < 3; ronde += 1) {
        await kapot.verwerkRonde();
        await wacht(20);
      }

      expect((await taken.dossier.getArchivering(rm, begin.id)).archivering).toMatchObject({
        id: eerste.id,
        status: "FAILED",
        fout: expect.any(String),
      });
      expect((await leesTaak(begin.id)).status).toBe("resultaat");
      expect(await db.prisma.client.auditEvent.count({ where: { taakinstantieId: begin.id, actie: "ARCHIVING_FAILED" } })).toBe(1);
      const stand = await taken.uitvoering.getVernietigingsresultaten(rm, begin.id);
      expect(stand.taak.toegestaneActies).toEqual(["archiveren"]);
      expect(stand.taak.archivering).toMatchObject({ status: "FAILED" });

      // Opnieuw, nu met een werkende archiefmap.
      const goed = worker("a", nepStekker().client, 60_000, { GOTENBERG_URL: gotenberg.url, ARCHIEF_PAD: archief });
      const tweede = await taken.dossier.archiveren(rm, begin.id, stand.taak.versie);
      await goed.verwerkRonde();

      expect((await taken.dossier.getArchivering(rm, begin.id)).archivering).toMatchObject({ id: tweede.id, status: "SUCCESS" });
      expect((await leesTaak(begin.id)).status).toBe("archief");
    } finally {
      await gotenberg.stop();
      await rm_(archief, { recursive: true, force: true });
    }
  });

  it("een terugkerende taak krijgt na archiveren de volgende geplande cyclus", async () => {
    const gotenberg = await nepGotenberg();
    const archief = await mkdtemp(path.join(tmpdir(), "archief-"));
    const nu = new Date();
    const dezeMaand = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1));
    const definitie = basis.taakdefinitie.id;
    try {
      await db.prisma.client.taakdefinitie.update({
        where: { id: definitie },
        data: { frequentie: "jaarlijks", startmaand: nu.getUTCMonth() + 1 },
      });
      const { taak, w } = await taakMetVerklaring(gotenberg.url, archief);
      // Deze cyclus was gepland op de 1e van deze maand.
      await db.prisma.client.taakinstantie.update({ where: { id: taak.id }, data: { geplandOp: dezeMaand } });

      await taken.dossier.archiveren(rm, taak.id, (await leesTaak(taak.id)).versie);
      await w.verwerkRonde();
      expect((await leesTaak(taak.id)).status).toBe("archief");

      const volgende = await db.prisma.client.taakinstantie.findFirstOrThrow({
        where: { taakdefinitieId: definitie, status: "init", geplandOp: { not: null } },
      });
      expect(volgende.geplandOp?.toISOString().slice(0, 10)).toBe(
        new Date(Date.UTC(nu.getUTCFullYear() + 1, nu.getUTCMonth(), 1)).toISOString().slice(0, 10)
      );
      expect(volgende.naam).toMatch(new RegExp(`${nu.getUTCFullYear() + 1}$`));
      expect(await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: volgende.id } })).toMatchObject({
        actie: "TASK_CREATED",
        actorType: "system",
      });
    } finally {
      await db.prisma.client.taakdefinitie.update({ where: { id: definitie }, data: { frequentie: "ad_hoc", startmaand: null } });
      await gotenberg.stop();
      await rm_(archief, { recursive: true, force: true });
    }
  });

  it("alleen de recordmanager van de taak mag archiveren", async () => {
    const gotenberg = await nepGotenberg();
    const archief = await mkdtemp(path.join(tmpdir(), "archief-"));
    try {
      const { taak } = await taakMetVerklaring(gotenberg.url, archief);
      const versie = (await leesTaak(taak.id)).versie;
      await expect(taken.dossier.archiveren(gebruiker("po1", "proceseigenaar"), taak.id, versie)).rejects.toThrow();
      await expect(taken.dossier.archiveren(rm, taak.id, versie - 1)).rejects.toThrow();
      expect(await db.prisma.client.archivering.count({ where: { taakinstantieId: taak.id } })).toBe(0);
    } finally {
      await gotenberg.stop();
      await rm_(archief, { recursive: true, force: true });
    }
  });
});
