import { describe, expect, it } from "vitest";
import { StekkerClient, StekkerFout, type StekkerVerbinding } from "./stekker-client.js";

type Opgenomen = { url: string; init: RequestInit };

// Nagebootste fetch: beantwoordt calls in volgorde en onthoudt wat er is verstuurd.
function nepFetch(antwoorden: Array<Response | (() => Promise<Response>) | Error>) {
  const verzonden: Opgenomen[] = [];
  const fetchFn = (async (url: string | URL, init: RequestInit = {}) => {
    verzonden.push({ url: String(url), init });
    const volgende = antwoorden.shift();

    if (!volgende) {
      throw new Error(`Onverwachte call naar ${url}`);
    }

    if (volgende instanceof Error) {
      throw volgende;
    }

    return typeof volgende === "function" ? volgende() : volgende;
  }) as typeof fetch;

  return { fetchFn, verzonden };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const verbinding = (overrides: Partial<StekkerVerbinding> = {}): StekkerVerbinding => ({
  id: "config-1",
  baseUrl: "http://stekker.test/",
  authType: "oauth2_cc",
  tokenUrl: "http://idp.test/token",
  clientId: "cockpit-stekker",
  secretRef: "STEKKER_SECRET",
  scopes: ["selectie.read", "selectie.write"],
  timeouts: { requestMs: 1000 },
  ...overrides,
});

const selectie = { selectieId: "sel-1", status: "RUNNING" };
const env = { STEKKER_SECRET: "geheim" };
const header = (opgenomen: Opgenomen, naam: string) => new Headers(opgenomen.init.headers).get(naam);

describe("StekkerClient: authenticatie", () => {
  it("haalt een token op met client credentials en stuurt het als Bearer mee", async () => {
    const { fetchFn, verzonden } = nepFetch([json(200, { access_token: "tok-1", expires_in: 300 }), json(202, selectie)]);
    const client = new StekkerClient({ fetchFn, env });

    await client.startSelectie(verbinding(), "2026-01-01", "taak-1:job-1");

    expect(verzonden[0].url).toBe("http://idp.test/token");
    const tokenBody = new URLSearchParams(String(verzonden[0].init.body));
    expect(Object.fromEntries(tokenBody)).toEqual({
      grant_type: "client_credentials",
      client_id: "cockpit-stekker",
      client_secret: "geheim",
      scope: "selectie.read selectie.write",
    });
    expect(verzonden[1].url).toBe("http://stekker.test/selecties");
    expect(header(verzonden[1], "authorization")).toBe("Bearer tok-1");
    expect(header(verzonden[1], "x-correlation-id")).toBe("taak-1:job-1");
    expect(JSON.parse(String(verzonden[1].init.body))).toEqual({ peildatum: "2026-01-01" });
  });

  it("hergebruikt het token tot 30 s voor verloop, en haalt daarna een nieuw", async () => {
    let nu = 1_000_000;
    const { fetchFn, verzonden } = nepFetch([
      json(200, { access_token: "tok-1", expires_in: 60 }),
      json(200, selectie),
      json(200, selectie),
      json(200, { access_token: "tok-2", expires_in: 60 }),
      json(200, selectie),
    ]);
    const client = new StekkerClient({ fetchFn, env, now: () => nu });

    await client.getSelectie(verbinding(), "sel-1", "c");
    nu += 29_000;
    await client.getSelectie(verbinding(), "sel-1", "c");
    nu += 2_000;
    await client.getSelectie(verbinding(), "sel-1", "c");

    expect(verzonden.map((call) => header(call, "authorization") ?? "token-aanvraag")).toEqual([
      "token-aanvraag",
      "Bearer tok-1",
      "Bearer tok-1",
      "token-aanvraag",
      "Bearer tok-2",
    ]);
  });

  it("haalt bij een 401 eenmalig een vers token en probeert opnieuw", async () => {
    const { fetchFn, verzonden } = nepFetch([
      json(200, { access_token: "verlopen", expires_in: 300 }),
      json(401, { code: "UNAUTHORIZED", message: "x" }),
      json(200, { access_token: "vers", expires_in: 300 }),
      json(200, selectie),
    ]);
    const client = new StekkerClient({ fetchFn, env });

    await expect(client.getSelectie(verbinding(), "sel-1", "c")).resolves.toMatchObject({ selectieId: "sel-1" });
    expect(header(verzonden[3], "authorization")).toBe("Bearer vers");
  });

  it("weigert authType 'none' in productie, en ontbrekende OAuth2-gegevens altijd", async () => {
    const { fetchFn } = nepFetch([]);
    const productie = new StekkerClient({ fetchFn, env: { NODE_ENV: "production" } });
    const zonderSecret = new StekkerClient({ fetchFn, env: {} });

    await expect(productie.getSelectie(verbinding({ authType: "none" }), "s", "c")).rejects.toMatchObject({
      details: { tijdelijk: false, code: "CONFIGURATIE" },
    });
    await expect(zonderSecret.getSelectie(verbinding(), "s", "c")).rejects.toMatchObject({
      details: { tijdelijk: false, code: "CONFIGURATIE" },
    });
  });

  it("stuurt bij authType 'none' (buiten productie) geen Authorization mee", async () => {
    const { fetchFn, verzonden } = nepFetch([json(200, selectie)]);
    await new StekkerClient({ fetchFn, env: {} }).getSelectie(verbinding({ authType: "none" }), "sel-1", "c");
    expect(header(verzonden[0], "authorization")).toBeNull();
  });
});

describe("StekkerClient: foutclassificatie", () => {
  const client = (antwoorden: Parameters<typeof nepFetch>[0]) =>
    new StekkerClient({ fetchFn: nepFetch(antwoorden).fetchFn, env: {} });
  const zonderAuth = verbinding({ authType: "none" });

  it("4xx is definitief en neemt code, correlatieId en logReference van de stekker over", async () => {
    const fout = await client([
      json(409, { code: "IDEMPOTENCY_KEY_CONFLICT", message: "x", correlatieId: "corr-9", logReference: "log-9" }),
    ])
      .startVernietiging(zonderAuth, { selectieId: "s", cockpitTaakId: "t", besluitReferentie: "b" }, "key-1", "c")
      .catch((error: unknown) => error);

    expect(fout).toBeInstanceOf(StekkerFout);
    expect((fout as StekkerFout).details).toEqual({
      tijdelijk: false,
      status: 409,
      code: "IDEMPOTENCY_KEY_CONFLICT",
      correlatieId: "corr-9",
      logReference: "log-9",
    });
  });

  it.each([
    ["5xx", () => json(503, { code: "SERVICE_UNAVAILABLE", message: "x" }), "SERVICE_UNAVAILABLE"],
    ["429", () => json(429, {}), undefined],
    ["netwerkfout", () => new TypeError("fetch failed"), "NETWERK"],
  ])("%s is tijdelijk", async (_wat, antwoord, code) => {
    await expect(client([antwoord()]).getSelectie(zonderAuth, "s", "c")).rejects.toMatchObject({
      details: { tijdelijk: true, ...(code ? { code } : {}) },
    });
  });

  it("een time-out is tijdelijk", async () => {
    // Een stekker die nooit antwoordt; net als echte fetch afbreken via het signal.
    const hangendeFetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;

    await expect(
      new StekkerClient({ fetchFn: hangendeFetch, env: {} }).getSelectie(
        verbinding({ authType: "none", timeouts: { requestMs: 50 } }),
        "s",
        "c"
      )
    ).rejects.toMatchObject({ details: { tijdelijk: true, code: "TIMEOUT" } });
  });
});

describe("StekkerClient: strikt contract", () => {
  const zonderAuth = verbinding({ authType: "none" });
  const met = (body: unknown) => new StekkerClient({ fetchFn: nepFetch([json(200, body)]).fetchFn, env: {} });

  it.each([
    ["selectiestatus i.p.v. status", { selectieId: "s", selectiestatus: "READY" }],
    ["niet-spec status", { selectieId: "s", status: "VOLTOOID" }],
    ["ontbrekend selectieId", { status: "READY" }],
  ])("weigert een selectie met %s", async (_wat, body) => {
    await expect(met(body).getSelectie(zonderAuth, "s", "c")).rejects.toMatchObject({
      details: { tijdelijk: false, code: "CONTRACT" },
    });
  });

  it("weigert een kandidatenpagina met objecten i.p.v. items", async () => {
    await expect(
      met({ selectieId: "s", objecten: [] }).getKandidaten(zonderAuth, "s", { offset: 0, limit: 500 }, "c")
    ).rejects.toMatchObject({ details: { code: "CONTRACT" } });
  });

  it("weigert een batchresultaat met een niet-spec resultaatwaarde", async () => {
    const body = [{ batchNummer: 1, resultaten: [{ vernietigingskandidaatId: "k", bronId: "b", resultaat: "GEWIJZIGD" }] }];
    await expect(met(body).getBatchResultaten(zonderAuth, "v", "c")).rejects.toMatchObject({
      details: { code: "CONTRACT" },
    });
  });

  it("stuurt Idempotency-Key en X-Correlation-ID apart mee", async () => {
    const { fetchFn, verzonden } = nepFetch([json(202, { batchNummer: 2, resultaten: [] })]);
    await new StekkerClient({ fetchFn, env: {} }).voegBatchToe(
      zonderAuth,
      "vern-1",
      { batchNummer: 2, objecten: [{ vernietigingskandidaatId: "k", bronId: "b" }] },
      "vernietiging-batch-vern-1-2",
      "taak-1:job-7"
    );

    expect(verzonden[0].url).toBe("http://stekker.test/vernietigingen/vern-1/batches");
    expect(header(verzonden[0], "idempotency-key")).toBe("vernietiging-batch-vern-1-2");
    expect(header(verzonden[0], "x-correlation-id")).toBe("taak-1:job-7");
  });
});
