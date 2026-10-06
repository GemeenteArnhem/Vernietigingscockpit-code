import { afterAll, describe, expect, it } from "vitest";
import { api, maakTaak, prisma } from "./helpers.js";

const API = process.env.E2E_API_URL ?? "http://localhost:39700/api/v1";

afterAll(async () => {
  await prisma.client.$disconnect();
});

// CC-11 en CC-15 over HTTP.
describe("API-hardening", () => {
  it("stuurt security-headers mee, geen X-Powered-By, en een correlatie-id", async () => {
    const antwoord = await fetch(`${API}/health`, { headers: { "x-correlation-id": "e2e-hardening-1" } });

    expect(antwoord.headers.get("x-powered-by")).toBeNull();
    expect(antwoord.headers.get("x-content-type-options")).toBe("nosniff");
    expect(antwoord.headers.get("strict-transport-security")).toMatch(/max-age/);
    expect(antwoord.headers.get("content-security-policy")).toBeTruthy();
    expect(antwoord.headers.get("x-correlation-id")).toBe("e2e-hardening-1");

    const zonder = await fetch(`${API}/health`);
    expect(zonder.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("CORS staat geen credentials toe en laat If-Match en de ETag door", async () => {
    const antwoord = await fetch(`${API}/taken`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,if-match",
      },
    });

    expect(antwoord.headers.get("access-control-allow-credentials")).toBeNull();
    expect(antwoord.headers.get("access-control-allow-headers")).toMatch(/If-Match/i);
  });

  it("een ongeldige body of query geeft 400 met uitleg, nooit 500", async () => {
    const { taakId } = await maakTaak("Hardening", "http://stekker:3000");

    const peildatum = await api("rm", `/taken/${taakId}/selectie`, { method: "POST", body: { peildatum: "gisteren" } });
    expect(peildatum.status).toBe(400);
    expect(peildatum.body).toMatchObject({ message: "Ongeldige invoer.", fouten: [expect.objectContaining({ veld: "peildatum" })] });

    const besluit = await api("rm", `/taken/${taakId}/kandidaten/00000000-0000-4000-8000-000000000001/beoordeling`, {
      method: "PATCH",
      body: { beoordeling: "MISSCHIEN" },
    });
    expect(besluit.status).toBe(400);

    expect((await api("rm", "/taken?scope=iedereen")).status).toBe(400);
    expect((await api("rm", `/taken/${taakId}/auditlog?perPagina=100000`)).status).toBe(400);
    expect((await api("rm", "/taken/geen-uuid/auditlog")).status).toBe(400);
  });

  it("begrenst anonieme verzoeken per IP (60 per minuut)", async () => {
    const statussen: number[] = [];
    for (let i = 0; i < 65; i += 1) {
      statussen.push((await fetch(`${API}/health`)).status);
    }

    expect(statussen.filter((status) => status === 429).length).toBeGreaterThan(0);
    expect(statussen.slice(0, 50).every((status) => status === 200)).toBe(true);
  });
});
