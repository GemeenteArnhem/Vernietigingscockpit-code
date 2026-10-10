import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm as rm_, writeFile } from "node:fs/promises";
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
import { mdtoKandidaat, specificatieXml, vernietigingsEvent } from "./helpers/kandidaat.js";
import { valideerMdto } from "../../src/modules/archief/mdto-xsd.testhulp.js";
import pg from "pg";
import { BestandArchiefAdapter } from "../../src/modules/archief/archief-adapter.js";
import { verifieerTaakKeten } from "../../src/modules/audit/audit.service.js";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { zetBewaartermijn } from "../../src/modules/werkkopie/bewaartermijn.js";
import { WerkkopieOpschoning } from "../../src/modules/werkkopie/opschoning.js";
import { WerkkopieService } from "../../src/modules/werkkopie/werkkopie.service.js";
import { PrismaService } from "../../src/shared/db/prisma.service.js";
import type { IdentificatieGegevens } from "@vernietigingscockpit/stekker-client";

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

type Stap = "start" | "batch" | "vrijgeven" | "status" | "resultaten" | "specificatie";
type Onderbreking = Error | "hang" | undefined;

function nepStekker(opties: {
  onderbreek?: (stap: Stap, details: { batchNummer?: number; aanroep: number }) => Onderbreking;
  resultaten?: (objecten: Array<{ vernietigingskandidaatId: string; identificatie: IdentificatieGegevens[]; batchNummer: number }>) => StekkerUitvoeringsresultaat[];
  eindstatus?: "COMPLETED" | "PARTIAL" | "FAILED";
  // Elke aanroep duurt zo lang (een trage stekker).
  vertragingMs?: number;
} = {}) {
  const perSleutel = new Map<string, unknown>();
  const vernietigingen = new Map<string, { batches: Map<number, Array<{ vernietigingskandidaatId: string; identificatie: IdentificatieGegevens[] }>>; vrijgegeven: boolean }>();
  const aanroepen: Record<Stap, number> = { start: 0, batch: 0, vrijgeven: 0, status: 0, resultaten: 0, specificatie: 0 };
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
    voegBatchToe: async (_v: unknown, id: string, body: { batchNummer: number; vernietigingskandidaten: Array<{ vernietigingskandidaatId: string; identificatie: IdentificatieGegevens[] }> }, sleutel: string) => {
      aanroepen.batch += 1;
      idempotent(sleutel, () => vernietigingen.get(id)!.batches.set(body.batchNummer, body.vernietigingskandidaten));
      return na("batch", { batchNummer: body.batchNummer, resultaten: [] }, body.batchNummer);
    },
    geefVrij: async (_v: unknown, id: string) => {
      aanroepen.vrijgeven += 1;
      vernietigingen.get(id)!.vrijgegeven = true;
      return na("vrijgeven", {
        vernietigingId: id,
        selectieId: "x",
        cockpitTaakId: "t",
        besluitReferentie: "b",
        status: "RUNNING",
        vernietigingsmethode: { begripLabel: "Fysiek verwijderd", begripBegrippenlijst: { verwijzingNaam: "Cockpit-vernietigingsmethoden" } },
        vernietigingsmethodeToelichting: "Geen back-ups.",
      });
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
        opties.resultaten?.(objecten) ??
        objecten.map((object) => ({ ...object, resultaat: "SUCCESS" as const, event: vernietigingsEvent() }));
      return na("resultaten", batches.map(([batchNummer]) => ({ batchNummer, resultaten: resultaten.filter((r) => r.batchNummer === batchNummer) })));
    },
    getSpecificatie: async (_v: unknown, _id: string, kandidaatId: string) => {
      aanroepen.specificatie += 1;
      return na("specificatie", specificatieXml(kandidaatId));
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
      // Vastgepind bij het aanmaken, zoals de applicatie doet (ADR-0005, B-M3).
      archiefvormer: { verwijzingNaam: "Gemeente Test" },
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
          ...mdtoKandidaat(`vk-${String(i).padStart(3, "0")}`, { kenmerk: `bron-${i}`, naam: `Zaak ${i}` }),
          beoordeling: "AKKOORD",
        })),
      },
    },
  });
  await client.$transaction((tx) =>
    schrijfAuditEvent(tx, { type: "user", user: gebruiker("arch1", "archivaris"), rol: "archivaris" }, {
      taakinstantieId: taak.id,
      eventType: "Accordering",
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

  const acties = (await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: taakId } })).map((e) => e.eventType);
  expect(acties.filter((a) => a === "Vernietigen")).toHaveLength(aantal);
  expect(acties.filter((a) => a === "Batch aangeboden")).toHaveLength(3);
  expect(acties.filter((a) => a === "Batch verwerkt")).toHaveLength(3);
  expect(acties.filter((a) => a === "Uitvoering gestart")).toHaveLength(1);
  expect((await leesTaak(taakId)).status).toBe("resultaat");

  // Stekker API v2 (ADR-0005): per vernietigde kandidaat het event, het tijdstip en de
  // MDTO-specificatie (gzip, met de SHA-256 van de XML); per uitvoering de methode.
  const metKandidaat = await db.prisma.client.uitvoeringsresultaat.findMany({
    where: { vernietigingId },
    include: { kandidaat: { select: { kandidaatId: true } } },
  });
  for (const regel of metKandidaat) {
    expect(regel.eventTijd).toBeInstanceOf(Date);
    expect(regel.event).toMatchObject({ eventType: { begripLabel: "Vernietigen" } });
    const xml = gunzipSync(Buffer.from(regel.specificatie!)).toString("utf8");
    expect(xml).toBe(specificatieXml(regel.kandidaat.kandidaatId));
    expect(regel.specificatieSha256).toBe(createHash("sha256").update(xml, "utf8").digest("hex"));
  }
  expect(await leesVernietiging(vernietigingId)).toMatchObject({
    vernietigingsmethode: { begripLabel: "Fysiek verwijderd" },
    vernietigingsmethodeToelichting: "Geen back-ups.",
  });
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
          .map((object) => ({ ...object, resultaat: "SUCCESS" as const, event: vernietigingsEvent() })),
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
    const mislukt = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, eventType: "Uitvoering mislukt" } });
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
        { vernietigingskandidaatId: "onbekend", identificatie: [{ identificatieKenmerk: "x", identificatieBron: "y" }], batchNummer: 1, resultaat: "SUCCESS" as const },
      ],
    });

    await draaiTot([worker("a", stekker.client)], afgerond(vernietiging.id));

    const na = await leesVernietiging(vernietiging.id);
    expect(na.status).toBe("INTEGRITEIT_MISLUKT");
    expect(na.fout).toMatch(/onbekende kandidaat onbekend/);
    expect(na.fout).toMatch(/meer dan één resultaat/);
  });
});

describe("specificaties (Stekker API v2, ADR-0005 B-M2)", () => {
  it("houdt de uitvoering lopend tot alle specificaties binnen zijn; een haperende stekker wordt opnieuw gevraagd", async () => {
    const { taak, vernietiging } = await maakOpdracht();
    let fouten = 0;
    const stekker = nepStekker({
      onderbreek: (stap) =>
        stap === "specificatie" && fouten++ < 3 ? new StekkerFout("time-out", { tijdelijk: true, code: "TIMEOUT" }) : undefined,
    });
    const w = worker("a", stekker.client);

    // Eerst mislukt het ophalen: de uitvoering is nog niet afgerond, de taak blijft in uitvoering.
    await draaiTot([w], async () => fouten >= 1);
    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "LOPEND" });
    expect((await leesTaak(taak.id)).status).toBe("uitvoering");

    await draaiTot([w], afgerond(vernietiging.id));

    expect(await leesVernietiging(vernietiging.id)).toMatchObject({ status: "AFGEROND" });
    await controleerEindbeeld(taak.id, vernietiging.id, stekker);
    // Elke specificatie is uiteindelijk precies één keer vastgelegd; geen dubbele batch-events.
    expect(await db.prisma.client.uitvoeringsresultaat.count({ where: { vernietigingId: vernietiging.id, specificatie: null } })).toBe(0);
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
      (event) => event.eventType
    );
    expect(acties.indexOf("Uitvoering mislukt")).toBeLessThan(acties.indexOf("Uitvoering opnieuw aangevraagd"));
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
    expect(new Set(resultaten.resultaten.map((r) => r.resultaat))).toEqual(new Set(["FAILED"]));
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

      const event = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, eventType: "Creatie" } });
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
  it("zet het dossier als MDTO-XML weg (verklaring, bijlage, auditlog, kandidaten, specificaties) en rondt de taak af", async () => {
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
      // MDTO in de schermen: archiefvormer van de taak, vernietigingsmethode en eventTijd per kandidaat.
      expect(voor.taak.archiefvormer).toEqual({ verwijzingNaam: "Gemeente Test" });
      expect(voor.resultaten[0]).toMatchObject({
        vernietigingsmethode: "Fysiek verwijderd",
        eventTijd: expect.stringMatching(/^\d{4}-/),
        aggregatieniveau: "Dossier",
        waardering: { begripLabel: "Tijdelijk te bewaren" },
      });
      expect((await taken.uitvoering.getUitvoering(rm, begin.id)).stekkers[0]).toMatchObject({
        vernietigingsmethode: "Fysiek verwijderd",
        vernietigingsmethodeToelichting: "Geen back-ups.",
      });

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
      // MDTO-XML 1.0.1 (ADR-0005 §7): dossier.mdto.xml is de referentie naar het pakket.
      const dossierXml = await readFile(path.join(map, "dossier.mdto.xml"));
      expect(createHash("sha256").update(dossierXml).digest("hex")).toBe(archivering!.dossierSha256);
      expect(dossierXml.toString("utf8")).toContain(`<identificatieKenmerk>${begin.id}</identificatieKenmerk>`);
      expect(await readdir(map)).not.toContain("manifest.json");

      // Elk dossierbestand heeft een MDTO-bestandsbeschrijving met de juiste SHA-256.
      for (const bestand of ["verklaring.pdf", "bijlage.csv", "auditlog.json"]) {
        const inhoud = await readFile(path.join(map, bestand));
        const beschrijving = (await readFile(path.join(map, `${bestand}.mdto.xml`))).toString("utf8");
        expect(beschrijving).toContain(`<checksumWaarde>${createHash("sha256").update(inhoud).digest("hex")}</checksumWaarde>`);
        expect(beschrijving).toContain(`<omvang>${inhoud.length}</omvang>`);
      }

      // Per aangeboden kandidaat de MDTO-beschrijving en per vernietigde kandidaat de
      // specificatie; de SHA-256 in de CSV-bijlage dekt beide.
      const [kop, ...regels] = (await readFile(path.join(map, "bijlage.csv"), "utf8")).split("\r\n").map((regel) => regel.split(","));
      const kolom = (naam: string) => kop.indexOf(naam);
      const aangeboden = regels.filter((regel) => regel[kolom("beoordeling")] === "AKKOORD");
      expect(aangeboden.length).toBeGreaterThan(0);
      expect((await readdir(path.join(map, "kandidaten"))).length).toBe(aangeboden.length);
      expect((await readdir(path.join(map, "specificaties"))).length).toBe(aangeboden.length);
      const cockpitXml: Record<string, Buffer> = { "dossier.mdto.xml": dossierXml };
      for (const regel of aangeboden) {
        const kandidaatXml = await readFile(path.join(map, regel[kolom("mdtoXml")]));
        expect(createHash("sha256").update(kandidaatXml).digest("hex")).toBe(regel[kolom("mdtoXmlSha256")]);
        expect(kandidaatXml.toString("utf8")).toContain("<begripLabel>Vernietigen</begripLabel>");
        const specificatie = await readFile(path.join(map, regel[kolom("specificatie")]));
        expect(createHash("sha256").update(specificatie).digest("hex")).toBe(regel[kolom("specificatieSha256")]);
        expect(regel[kolom("eventTijd")]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        cockpitXml[regel[kolom("mdtoXml")]] = kandidaatXml;
      }
      for (const naam of (await readdir(map)).filter((naam) => naam.endsWith(".mdto.xml"))) {
        cockpitXml[naam] = await readFile(path.join(map, naam));
      }
      // Alle MDTO-XML van de cockpit voldoet aan de XSD (overgeslagen zonder Python + lxml).
      const fouten = valideerMdto(cockpitXml);
      if (fouten !== null) {
        expect(fouten).toEqual([]);
      }

      const events = await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: begin.id }, orderBy: { id: "asc" } });
      const acties = events.map((event) => event.eventType);
      expect(acties.indexOf("Archivering aangevraagd")).toBeLessThan(acties.indexOf("Export"));
      expect(events.find((event) => event.eventType === "Archivering aangevraagd")).toMatchObject({ actorType: "user" });
      expect(events.find((event) => event.eventType === "Export")).toMatchObject({
        actorType: "system",
        details: expect.objectContaining({ archiveringId: aanvraag.id, dossierSha256: archivering!.dossierSha256 }),
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
      expect(await db.prisma.client.auditEvent.count({ where: { taakinstantieId: begin.id, eventType: "Archivering mislukt" } })).toBe(1);
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
        eventType: "Creatie",
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

// ---------------------------------------------------------------------------------------
// Verwijderen van de werkkopie na archivering (ADR-0006).

async function gearchiveerdeTaak(gotenbergUrl: string, archief: string) {
  const { taak, w } = await taakMetVerklaring(gotenbergUrl, archief);
  const aanvraag = await taken.dossier.archiveren(rm, taak.id, (await leesTaak(taak.id)).versie);
  await w.verwerkRonde();
  expect((await leesTaak(taak.id)).status).toBe("archief");
  const archivering = await db.prisma.client.archivering.findUniqueOrThrow({ where: { id: aanvraag.id } });
  return { taakId: taak.id, archivering };
}

const zetTermijn = (waarde: string) =>
  db.prisma.client.$transaction((tx) => zetBewaartermijn(tx, { type: "system" }, waarde));

describe("werkkopie verwijderen (ADR-0006)", () => {
  let appPrisma: PrismaService;
  let archief: string;
  let gotenberg: Awaited<ReturnType<typeof nepGotenberg>>;
  const opschoning = () => new WerkkopieOpschoning(appPrisma, () => new BestandArchiefAdapter(archief), "P12M", { type: "system" });

  beforeAll(async () => {
    // De opschoning draait zoals in productie als de applicatierol (geen DELETE op het auditlog).
    appPrisma = new PrismaService(new ConfigService({ DATABASE_URL: db.appUrl }));
    archief = await mkdtemp(path.join(tmpdir(), "archief-"));
    gotenberg = await nepGotenberg();
  });

  afterAll(async () => {
    await appPrisma?.client.$disconnect();
    await gotenberg?.stop();
    await rm_(archief, { recursive: true, force: true });
  });

  it("laat de werkkopie staan zolang de termijn niet verstreken is", async () => {
    await zetTermijn("P12M");
    const { taakId } = await gearchiveerdeTaak(gotenberg.url, archief);

    await expect(opschoning().verwerk()).resolves.toMatchObject({ verwijderd: [] });
    expect((await leesTaak(taakId)).status).toBe("archief");
  });

  it("verwijdert na verificatie alle gegevens van de taak, met grafsteen en configuratie-event", async () => {
    await zetTermijn("P12M");
    const { taakId, archivering } = await gearchiveerdeTaak(gotenberg.url, archief);
    const keten = await verifieerTaakKeten(db.prisma, taakId);
    await zetTermijn("P0D");

    const uitkomst = await opschoning().verwerk();
    expect(uitkomst.verwijderd).toContain(taakId);

    const c = db.prisma.client;
    expect(await c.taakinstantie.count({ where: { id: taakId } })).toBe(0);
    expect(await c.auditEvent.count({ where: { taakinstantieId: taakId } })).toBe(0);
    expect(await c.kandidaatBesluit.count({ where: { taakinstantieId: taakId } })).toBe(0);
    expect(await c.selectie.count({ where: { taakinstantieId: taakId } })).toBe(0);
    expect(await c.verklaring.count({ where: { taakinstantieId: taakId } })).toBe(0);
    expect(await c.archivering.count({ where: { taakinstantieId: taakId } })).toBe(0);

    const grafsteen = await c.dossierGrafsteen.findUniqueOrThrow({ where: { taakinstantieId: taakId } });
    expect(grafsteen).toMatchObject({
      archiveringId: archivering.id,
      dossierSha256: archivering.dossierSha256,
      auditAantalEvents: keten.aantalEvents,
      auditLaatsteHash: keten.laatsteHash,
      bewaartermijnWerkkopie: "P0D",
      verificatie: expect.objectContaining({ uitkomst: "geslaagd" }),
    });
    // Geen taaknaam of persoonsgegevens in de grafsteen.
    expect(JSON.stringify(grafsteen, (_, waarde) => (typeof waarde === "bigint" ? waarde.toString() : waarde))).not.toMatch(/rm1|Uitvoering/);
    expect(await c.configuratieEvent.findFirst({ where: { eventType: "Werkkopie verwijderd", entiteitId: taakId } })).toMatchObject({
      actorType: "system",
      details: expect.objectContaining({ grafsteenId: grafsteen.id.toString(), auditLaatsteHash: keten.laatsteHash }),
    });

    // Na verwijderen: de grafsteen voor de auditor en de betrokkenen; anderen 404.
    const service = new WerkkopieService(db.prisma, new ConfigService({}), new CurrentMedewerkerService(db.prisma));
    await expect(service.getDossier(gebruiker("auditor1", "auditor"), taakId)).resolves.toMatchObject({
      status: "werkkopie_verwijderd",
      grafsteen: { auditlog: { laatsteHash: keten.laatsteHash }, archivering: { id: archivering.id } },
    });
    await expect(service.getDossier(rm, taakId)).resolves.toMatchObject({ status: "werkkopie_verwijderd" });
    await expect(service.getDossier(gebruiker("vreemde", "recordmanager"), taakId)).rejects.toThrow(/niet gevonden/);
    await expect(service.verifieerGrafstenen()).resolves.toMatchObject({ intact: true, fouten: [] });
  });

  it("verwijdert niet als het gearchiveerde pakket niet meer klopt, en legt dat vast", async () => {
    await zetTermijn("P12M");
    const { taakId, archivering } = await gearchiveerdeTaak(gotenberg.url, archief);
    await writeFile(path.join(archivering.locatie!, "bijlage.csv"), "gewijzigd");
    await zetTermijn("P0D");

    const uitkomst = await opschoning().verwerk();
    expect(uitkomst.verificatieMislukt).toContain(taakId);
    expect((await leesTaak(taakId)).status).toBe("archief");
    expect(await db.prisma.client.dossierGrafsteen.count({ where: { taakinstantieId: taakId } })).toBe(0);
    expect(
      await db.prisma.client.configuratieEvent.findFirst({ where: { eventType: "Verificatie archief mislukt", entiteitId: taakId } })
    ).toMatchObject({ details: expect.objectContaining({ fout: expect.stringMatching(/bijlage\.csv/) }) });
  });

  it("de database dwingt af: geen directe DELETE, geen verwijderen buiten de voorwaarden, grafsteen onveranderlijk", async () => {
    await zetTermijn("P12M");
    const { taakId } = await gearchiveerdeTaak(gotenberg.url, archief);
    const app = new pg.Client({ connectionString: db.appUrl });
    await app.connect();
    try {
      await expect(app.query('DELETE FROM "audit_event" WHERE "taakinstantie_id" = $1', [taakId])).rejects.toThrow(/permission denied/);
      // Ook de eigenaar kan niet direct verwijderen: de trigger staat het alleen toe binnen verwijder_werkkopie().
      await expect(db.prisma.client.auditEvent.deleteMany({ where: { taakinstantieId: taakId } })).rejects.toThrow(/append-only/);
      // Zonder grafsteen, verificatie en verstreken termijn weigert de functie.
      await expect(app.query("SELECT verwijder_werkkopie($1::uuid, 999999)", [taakId])).rejects.toThrow(/geen grafsteen/);
      await expect(app.query('UPDATE "dossier_grafsteen" SET "hash" = $1', ["x"])).rejects.toThrow(/permission denied/);
      await expect(db.prisma.client.dossierGrafsteen.updateMany({ data: { hash: "x" } })).rejects.toThrow(/append-only/);
    } finally {
      await app.end();
    }
    expect((await leesTaak(taakId)).status).toBe("archief");
  });

  it("de worker plant de opschoning en voert hem uit; de beginwaarde komt uit WERKKOPIE_BEWAARTERMIJN", async () => {
    const { taakId } = await gearchiveerdeTaak(gotenberg.url, archief);
    // Schone lei: geen geplande opschoning en nog geen vastgelegde termijn.
    await db.prisma.client.outbox.deleteMany({ where: { queue: "opschoning" } });
    await db.prisma.client.instelling.deleteMany({});
    const w = worker("a", nepStekker().client, 60_000, {
      GOTENBERG_URL: gotenberg.url,
      ARCHIEF_PAD: archief,
      WERKKOPIE_BEWAARTERMIJN: "P0D",
      OPSCHONING_INTERVAL: "PT0S",
    });

    await w.verwerkRonde();

    expect(await db.prisma.client.taakinstantie.count({ where: { id: taakId } })).toBe(0);
    expect(await db.prisma.client.instelling.findUniqueOrThrow({ where: { sleutel: "werkkopie_bewaartermijn" } })).toMatchObject({ waarde: "P0D" });
    expect(
      await db.prisma.client.configuratieEvent.findFirst({ where: { eventType: "Instelling gewijzigd" }, orderBy: { id: "desc" } })
    ).toMatchObject({ details: expect.objectContaining({ nieuw: "P0D", oud: null }) });
    expect(await db.prisma.client.outbox.findMany({ where: { queue: "opschoning" }, select: { status: true } })).toEqual(
      expect.arrayContaining([{ status: "VERWERKT" }])
    );
  });
});
