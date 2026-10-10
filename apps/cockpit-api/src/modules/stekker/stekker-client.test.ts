import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { versleutel } from "../../shared/geheim/geheim.js";
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

// Stekker API v2: elke response meldt de volledige versie in API-Version (API-57).
const json = (status: number, body: unknown, apiVersie = "2.0.0") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "API-Version": apiVersie } });

const verbinding = (overrides: Partial<StekkerVerbinding> = {}): StekkerVerbinding => ({
  id: "config-1",
  baseUrl: "http://stekker.test/",
  authType: "oauth2_cc",
  tokenUrl: "http://idp.test/token",
  clientId: "cockpit-stekker",
  secretRef: "STEKKER_SECRET",
  scopes: ["selectie.read", "selectie.write"],
  timeouts: { requestMs: 1000 },
  verwachteApiMajor: 2,
  ...overrides,
});

const selectie = { selectieId: "sel-1", status: "RUNNING" };
const identificatie = [{ identificatieKenmerk: "b-1", identificatieBron: "Testbron" }];
const begrip = (begripLabel: string, begripCode?: string) => ({
  begripLabel,
  ...(begripCode ? { begripCode } : {}),
  begripBegrippenlijst: { verwijzingNaam: "Testlijst" },
});
// Een kandidaat met alle verplichte velden van het MDTO-profiel (Stekker API v2).
const kandidaat = (overrides: Record<string, unknown> = {}) => ({
  vernietigingskandidaatId: "k-1",
  identificatie,
  naam: "Dossier 1",
  aggregatieniveau: begrip("Dossier"),
  waardering: begrip("Tijdelijk te bewaren", "V"),
  bewaartermijn: { termijnEinddatum: "2025-01-01" },
  informatiecategorie: begrip("Handhaving", "11.1"),
  ...overrides,
});
const env = { STEKKER_SECRET: "geheim" };
const header = (opgenomen: Opgenomen, naam: string) => new Headers(opgenomen.init.headers).get(naam);

describe("StekkerClient: authenticatie", () => {
  it("haalt een token op met client credentials en stuurt het als Bearer mee", async () => {
    const { fetchFn, verzonden } = nepFetch([json(200, { access_token: "tok-1", expires_in: 300 }), json(202, selectie)]);
    const client = new StekkerClient({ fetchFn, env });

    await client.startSelectie(verbinding(), "2026-01-01", "selectie-sel-1", "taak-1:job-1");

    expect(verzonden[0].url).toBe("http://idp.test/token");
    const tokenBody = new URLSearchParams(String(verzonden[0].init.body));
    expect(Object.fromEntries(tokenBody)).toEqual({
      grant_type: "client_credentials",
      client_id: "cockpit-stekker",
      client_secret: "geheim",
      scope: "selectie.read selectie.write",
    });
    expect(verzonden[1].url).toBe("http://stekker.test/v2/selecties");
    expect(header(verzonden[1], "authorization")).toBe("Bearer tok-1");
    expect(header(verzonden[1], "idempotency-key")).toBe("selectie-sel-1");
    expect(header(verzonden[1], "x-correlation-id")).toBe("taak-1:job-1");
    expect(JSON.parse(String(verzonden[1].init.body))).toEqual({ peildatum: "2026-01-01" });
  });

  it("gebruikt een versleuteld secret uit stekkerbeheer, met voorrang op secretRef", async () => {
    const sleutel = randomBytes(32);
    const { fetchFn, verzonden } = nepFetch([json(200, { access_token: "tok-1", expires_in: 300 }), json(202, selectie)]);
    const client = new StekkerClient({ fetchFn, env: { ...env, SECRET_ENCRYPTION_KEY: sleutel.toString("base64") } });

    await client.startSelectie(verbinding({ secretVersleuteld: versleutel("uit-de-database", sleutel) }), null, "k", "c");

    expect(new URLSearchParams(String(verzonden[0].init.body)).get("client_secret")).toBe("uit-de-database");
  });

  it("een versleuteld secret zonder (juiste) sleutel is een definitieve configuratiefout", async () => {
    const opgeslagen = versleutel("x", randomBytes(32));
    const client = new StekkerClient({ fetchFn: nepFetch([]).fetchFn, env: { SECRET_ENCRYPTION_KEY: randomBytes(32).toString("base64") } });

    await expect(client.getSelectie(verbinding({ secretVersleuteld: opgeslagen }), "sel-1", "c")).rejects.toMatchObject({
      details: { tijdelijk: false, code: "CONFIGURATIE" },
    });
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
      json(409, { code: "IDEMPOTENCY_KEY_REUSED", message: "x", correlatieId: "corr-9", logReference: "log-9" }),
    ])
      .startVernietiging(zonderAuth, { selectieId: "s", cockpitTaakId: "t", besluitReferentie: "b" }, "key-1", "c")
      .catch((error: unknown) => error);

    expect(fout).toBeInstanceOf(StekkerFout);
    expect((fout as StekkerFout).details).toEqual({
      tijdelijk: false,
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
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
    const body = [{ batchNummer: 1, resultaten: [{ vernietigingskandidaatId: "k", identificatie, resultaat: "GEWIJZIGD" }] }];
    await expect(met(body).getBatchResultaten(zonderAuth, "v", "c")).rejects.toMatchObject({
      details: { code: "CONTRACT" },
    });
  });

  it("stuurt Idempotency-Key en X-Correlation-ID apart mee", async () => {
    const { fetchFn, verzonden } = nepFetch([json(202, { batchNummer: 2, resultaten: [] })]);
    await new StekkerClient({ fetchFn, env: {} }).voegBatchToe(
      zonderAuth,
      "vern-1",
      { batchNummer: 2, vernietigingskandidaten: [{ vernietigingskandidaatId: "k", identificatie }] },
      "vernietiging-batch-vern-1-2",
      "taak-1:job-7"
    );

    expect(verzonden[0].url).toBe("http://stekker.test/v2/vernietigingen/vern-1/batches");
    expect(header(verzonden[0], "idempotency-key")).toBe("vernietiging-batch-vern-1-2");
    expect(header(verzonden[0], "x-correlation-id")).toBe("taak-1:job-7");
  });
});

describe("StekkerClient: Stekker API v2 (MDTO)", () => {
  const zonderAuth = verbinding({ authType: "none" });
  const met = (antwoord: Response) => new StekkerClient({ fetchFn: nepFetch([antwoord]).fetchFn, env: {} });
  const pagina = (items: unknown[]) => ({ selectieId: "s", items, totaal: items.length });

  it("haalt kandidaten op via /v2/…/vernietigingskandidaten en accepteert het MDTO-profiel", async () => {
    const { fetchFn, verzonden } = nepFetch([json(200, pagina([kandidaat()]))]);
    const resultaat = await new StekkerClient({ fetchFn, env: {} }).getKandidaten(zonderAuth, "s", { offset: 0, limit: 500 }, "c");

    expect(verzonden[0].url).toBe("http://stekker.test/v2/selecties/s/vernietigingskandidaten?offset=0&limit=500");
    expect(resultaat.items[0].naam).toBe("Dossier 1");
  });

  it.each([
    ["zonder identificatie", kandidaat({ identificatie: [] })],
    ["identificatie zonder bron", kandidaat({ identificatie: [{ identificatieKenmerk: "x" }] })],
    ["niet-MDTO aggregatieniveau", kandidaat({ aggregatieniveau: begrip("Groepering") })],
    ["onbekende waardering", kandidaat({ waardering: begrip("Vernietigen", "VERNIETIGEN") })],
    ["zonder einddatum bewaartermijn", kandidaat({ bewaartermijn: { termijnLooptijd: "P5Y" } })],
    ["zonder informatiecategorie", kandidaat({ informatiecategorie: undefined })],
  ])("weigert een kandidaat %s", async (_wat, item) => {
    await expect(met(json(200, pagina([item]))).getKandidaten(zonderAuth, "s", { offset: 0, limit: 500 }, "c")).rejects.toMatchObject({
      details: { tijdelijk: false, code: "CONTRACT" },
    });
  });

  it("weigert een response zonder passende API-Version", async () => {
    await expect(met(json(200, selectie, "1.0.0")).getSelectie(zonderAuth, "s", "c")).rejects.toMatchObject({
      details: { code: "CONTRACT" },
    });
  });

  it("weigert een stekkerconfiguratie met een niet-ondersteunde major versie", async () => {
    await expect(met(json(200, selectie)).getSelectie(verbinding({ authType: "none", verwachteApiMajor: 1 }), "s", "c")).rejects.toMatchObject({
      details: { tijdelijk: false, code: "CONFIGURATIE" },
    });
  });

  it("eist bij SUCCESS het event Vernietigen met tijdstip", async () => {
    const zonderEvent = [{ batchNummer: 1, resultaten: [{ vernietigingskandidaatId: "k", identificatie, resultaat: "SUCCESS" }] }];
    const metEvent = [{
      batchNummer: 1,
      resultaten: [{
        vernietigingskandidaatId: "k",
        identificatie,
        resultaat: "SUCCESS",
        event: { eventType: begrip("Vernietigen"), eventTijd: "2026-10-08T10:00:00Z" },
      }],
    }];

    await expect(met(json(200, zonderEvent)).getBatchResultaten(zonderAuth, "v", "c")).rejects.toMatchObject({
      details: { code: "CONTRACT" },
    });
    await expect(met(json(200, metEvent)).getBatchResultaten(zonderAuth, "v", "c")).resolves.toHaveLength(1);
  });

  it("haalt de MDTO-XML-specificatie op", async () => {
    const xml = '<?xml version="1.0"?><MDTO xmlns="https://www.nationaalarchief.nl/mdto"><informatieobject/></MDTO>';
    const { fetchFn, verzonden } = nepFetch([
      new Response(xml, { status: 200, headers: { "content-type": "application/xml", "API-Version": "2.0.0" } }),
    ]);

    await expect(new StekkerClient({ fetchFn, env: {} }).getSpecificatie(zonderAuth, "v-1", "k-1", "c")).resolves.toBe(xml);
    expect(verzonden[0].url).toBe("http://stekker.test/v2/vernietigingen/v-1/specificaties/k-1");
    expect(header(verzonden[0], "accept")).toBe("application/xml");
  });
});
