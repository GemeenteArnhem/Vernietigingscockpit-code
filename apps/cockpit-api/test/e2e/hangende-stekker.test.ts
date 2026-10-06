import { afterAll, describe, expect, it } from "vitest";
import { api, controleerBijStekker, maakTaak, prisma, statuswijziging, totVrijgegeven, wachtOp } from "./helpers.js";

// Scenario F: een hangende stekker. stekker-hangt antwoordt pas na 3 s; met een time-out van
// 1 s in de stekkerconfiguratie krijgt de cockpit nooit op tijd antwoord. Na het maximum
// aantal pogingen (WORKER_MAX_POGINGEN, standaard 8) moet de cockpit stoppen, de fout tonen
// en herstel via de recordmanager toelaten, zonder iets dubbel te doen.

const STEKKER = "http://stekker-hangt:3000";
const STEKKER_VANAF_HOST = "http://localhost:39707";
const KORT = { requestMs: 1_000 };
const RUIM = { requestMs: 10_000 };

afterAll(async () => {
  await prisma.client.$disconnect();
});

const jobs = (taakId: string, jobNaam: string) =>
  prisma.client.outbox.findMany({ where: { taakinstantieId: taakId, jobNaam }, orderBy: { aangemaaktOp: "asc" } });

describe("hangende stekker (scenario F)", () => {
  it("selectie: na de nieuwe pogingen FAILED met time-out; herkansen met een nieuwe configuratie lukt", async () => {
    const { taakId, stekkerId } = await maakTaak("Scenario F (selectie hangt)", STEKKER, KORT);
    expect((await api("rm", `/taken/${taakId}/selectie`, { method: "POST", body: {} })).status).toBe(201);

    const mislukt = await wachtOp(
      "selectie mislukt",
      () => api("rm", `/taken/${taakId}/selectie`),
      (antwoord) => antwoord.body?.stekkers?.[0]?.selectie?.status === "FAILED",
      120_000
    );
    expect(mislukt.body.stekkers[0].selectie.fout).toMatch(/Geen antwoord binnen 1000 ms/);
    expect(mislukt.body.stekkers[0].selectie.fout).toMatch(/Opgegeven na 8 pogingen/);
    expect((await jobs(taakId, "selectie:start")).map((job) => [job.status, job.pogingen])).toEqual([["MISLUKT", 8]]);
    expect((await api("rm", `/taken/${taakId}`)).body.status).toBe("init");

    // De beheerder legt een nieuwe configuratieversie vast met een ruimere time-out; de
    // recordmanager herkanst. De nieuwe selectie gebruikt de nieuwste configuratie.
    await prisma.client.stekkerConfiguratie.create({
      data: {
        ...(await nieuweVersie(stekkerId)),
        timeouts: RUIM,
      },
    });
    const herkansing = await api("rm", `/taken/${taakId}/selectie`, { method: "POST", body: { stekkerId } });
    expect(herkansing.status).toBe(201);

    await wachtOp("taak naar beoordeling", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "beoordeling", 120_000);
    const stand = await api("rm", `/taken/${taakId}/selectie`);
    expect(stand.body.stekkers[0].selectie.status).toBe("GEIMPORTEERD");
    const selecties = await prisma.client.selectie.findMany({
      where: { taakinstantieId: taakId },
      orderBy: { stekkerConfiguratie: { versie: "asc" } },
      include: { stekkerConfiguratie: { select: { versie: true } } },
    });
    expect(selecties.map((selectie) => [selectie.status, selectie.stekkerConfiguratie.versie])).toEqual([
      ["VERVANGEN", 1],
      ["GEIMPORTEERD", 2],
    ]);
  }, 300_000);

  it("uitvoering: na de nieuwe pogingen MISLUKT, taak blijft in uitvoering; opnieuw proberen rondt af zonder dubbel werk", async () => {
    const { taakId, stekkerId } = await maakTaak("Scenario F (vernietiging hangt)", STEKKER, RUIM);
    const { aantalKandidaten } = await totVrijgegeven(taakId);

    // Vanaf nu antwoordt de stekker niet meer binnen de time-out (in de test: de time-out
    // van de vastgepinde configuratie verkorten).
    await prisma.client.stekkerConfiguratie.updateMany({ where: { stekkerId }, data: { timeouts: KORT } });
    expect((await statuswijziging("rm", taakId, "vernietigingsopdracht")).status).toBe(201);

    const mislukt = await wachtOp(
      "opdracht mislukt",
      () => api("rm", `/taken/${taakId}/uitvoering`),
      (antwoord) => antwoord.body?.stekkers?.[0]?.vernietigingStatus === "MISLUKT",
      120_000
    );
    expect(mislukt.body.stekkers[0].fout).toMatch(/Geen antwoord binnen 1000 ms/);
    expect(mislukt.body.stekkers[0].toegestaneActies).toEqual(["vernietiging.opnieuw"]);
    expect((await jobs(taakId, "vernietiging:start")).map((job) => [job.status, job.pogingen])).toEqual([["MISLUKT", 8]]);
    expect((await api("rm", `/taken/${taakId}`)).body.status).toBe("uitvoering");

    // De stekker is weer bereikbaar binnen de time-out; de recordmanager probeert opnieuw.
    await prisma.client.stekkerConfiguratie.updateMany({ where: { stekkerId }, data: { timeouts: RUIM } });
    expect((await api("rm", `/taken/${taakId}/uitvoering/${stekkerId}/opnieuw`, { method: "POST" })).status).toBe(201);
    await wachtOp("taak naar resultaat", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "resultaat", 300_000);

    // Eén vernietiging (zelfde Idempotency-Key bij elke poging), elke kandidaat één keer.
    expect(await prisma.client.vernietiging.count({ where: { taakinstantieId: taakId } })).toBe(1);
    await controleerBijStekker(STEKKER_VANAF_HOST, taakId, aantalKandidaten);
    // Elke stekkeraanroep duurt 3 s: deze test heeft ruim de tijd nodig.
  }, 360_000);
});

// Kopie van de laatste configuratieversie, met het volgende versienummer.
async function nieuweVersie(stekkerId: string) {
  const laatste = await prisma.client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId }, orderBy: { versie: "desc" } });
  return {
    stekkerId,
    versie: laatste.versie + 1,
    baseUrl: laatste.baseUrl,
    authType: laatste.authType,
    tokenUrl: laatste.tokenUrl,
    clientId: laatste.clientId,
    secretRef: laatste.secretRef,
    scopes: laatste.scopes,
    parameters: laatste.parameters ?? {},
    verwachteApiMajor: laatste.verwachteApiMajor,
    aangemaaktDoor: "e2e",
  };
}
