import { afterAll, describe, expect, it } from "vitest";
import { api, maakTaak, prisma, wachtOp } from "./helpers.js";

const API = process.env.E2E_API_URL ?? "http://localhost:39700/api/v1";
const MAX_RESPONSE = 1_000_000;

afterAll(async () => {
  await prisma.client.$disconnect();
});

// Scenario H (CC-10): een taak met 15.000 kandidaten is te beoordelen zonder responses
// groter dan ~1 MB.
describe("grote lijst (scenario H)", () => {
  it("pagineert, selecteert alles over pagina's en beoordeelt in één bulkverzoek", async () => {
    const { taakId } = await maakTaak("Grote lijst", "http://stekker-groot:3000");
    // Peildatum ver in de toekomst: alle 15.000 records van de dataset komen mee.
    expect((await api("rm", `/taken/${taakId}/selectie`, { method: "POST", body: { peildatum: "2050-01-01" } })).status).toBe(201);
    await wachtOp("taak naar beoordeling", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "beoordeling", 300_000);

    const grootte = async (pad: string) => {
      const antwoord = await fetch(`${API}${pad}`, {
        headers: { authorization: `Bearer ${await tokenVan()}` },
      });
      const tekst = await antwoord.text();
      expect(antwoord.status, pad).toBe(200);
      return { bytes: Buffer.byteLength(tekst), body: JSON.parse(tekst) };
    };

    const pagina = await grootte(`/taken/${taakId}/kandidaten?offset=0&limit=100`);
    expect(pagina.body.pagina.totaal).toBe(15_000);
    expect(pagina.body.kandidaten).toHaveLength(100);
    expect(pagina.bytes).toBeLessThan(MAX_RESPONSE);

    const groot = await grootte(`/taken/${taakId}/kandidaten?offset=14750&limit=250`);
    expect(groot.body.kandidaten).toHaveLength(250);
    expect(groot.body.kandidaten.at(-1).volgnummer).toBe(15_000);
    expect(groot.bytes).toBeLessThan(MAX_RESPONSE);

    const ids = await grootte(`/taken/${taakId}/kandidaten/ids`);
    expect(ids.body.ids).toHaveLength(15_000);
    expect(ids.bytes).toBeLessThan(MAX_RESPONSE);

    // Alles in één verzoek akkoord, en daarna voorleggen.
    const { etag } = await api("rm", `/taken/${taakId}`);
    const start = Date.now();
    const bulk = await api("rm", `/taken/${taakId}/kandidaten`, {
      method: "PATCH",
      ifMatch: etag ?? undefined,
      body: { ids: ids.body.ids, beoordeling: "AKKOORD" },
    });
    const duur = Date.now() - start;
    expect(bulk.status, JSON.stringify(bulk.body)).toBe(200);
    expect(bulk.body).toEqual({ bijgewerkt: 15_000 });
    console.log(`Bulkbeoordeling van 15.000 kandidaten: ${duur} ms`);

    const na = await grootte(`/taken/${taakId}/kandidaten?limit=1`);
    expect(na.body.tellingen).toMatchObject({ totaal: 15_000, opgenomen: 0, akkoord: 15_000 });

    const voorleggen = await api("rm", `/taken/${taakId}/beoordeling/voorleggen`, { method: "POST", ifMatch: etag ?? undefined });
    expect(voorleggen.status).toBe(201);

    const verificatie = await api("rm", `/taken/${taakId}/auditlog/verificatie`);
    expect(verificatie.body).toMatchObject({ intact: true });
    expect(verificatie.body.aantalEvents).toBeGreaterThan(15_000);
  }, 600_000);
});

// Token van de recordmanager, via de helpers (api() gebruikt hetzelfde token).
async function tokenVan() {
  const IDP = process.env.E2E_IDP_URL ?? "http://localhost:39701";
  const antwoord = await fetch(`${IDP}/test/gebruikerstoken`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "rm1", roles: ["recordmanager"], email: "rm1@example.test" }),
  });
  return ((await antwoord.json()) as { access_token: string }).access_token;
}
