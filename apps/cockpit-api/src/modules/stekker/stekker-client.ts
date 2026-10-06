// Eén client voor alle communicatie met stekkers, volgens de Stekker-OpenAPI-spec
// (v1.0.0). De cockpit bevat geen stekkerspecifieke code: verschillen tussen stekkers
// zitten uitsluitend in de stekkerconfiguratie.
//
// - Authenticatie: OAuth2 client credentials (token gecachet per configuratieversie),
//   of 'none' (alleen buiten productie).
// - Elke call heeft een time-out en een X-Correlation-ID.
// - Responses worden strikt getoetst aan de spec; afwijkingen zijn contractfouten.
// - Elke fout is een StekkerFout met `tijdelijk`: true bij 5xx, 429, time-out en
//   netwerkfouten (opnieuw proberen zinvol), false bij 4xx en contractfouten.

import type {
  BatchResultaat,
  Selectie,
  SelectieStart,
  SelectieStatus,
  Uitvoeringsresultaat,
  UitvoeringsresultaatWaarde,
  VernietigingBatch,
  Vernietigingskandidaat,
  VernietigingskandidatenPagina,
  VernietigingStart,
  VernietigingStatus,
  Vernietigingsuitvoering,
  VernietigingVrijgave,
} from "@vernietigingscockpit/stekker-client";

// De types komen uit de vastgepinde spec (packages/stekker-client, CC-19). De lijsten
// hieronder gebruikt de client om enumwaarden te toetsen; `satisfies` dwingt af dat ze
// precies gelijk zijn aan de enums in de spec.
const selectieStatussen = { IDLE: true, RUNNING: true, READY: true, FAILED: true } satisfies Record<SelectieStatus, true>;
const vernietigingStatussen = {
  IDLE: true,
  RUNNING: true,
  COMPLETED: true,
  PARTIAL: true,
  FAILED: true,
} satisfies Record<VernietigingStatus, true>;
const uitvoeringsresultaten = {
  SUCCESS: true,
  FAILED: true,
  SKIPPED: true,
  NOT_FOUND: true,
  CHANGED: true,
} satisfies Record<UitvoeringsresultaatWaarde, true>;

export const SELECTIE_STATUSSEN = Object.keys(selectieStatussen) as SelectieStatus[];
export const VERNIETIGING_STATUSSEN = Object.keys(vernietigingStatussen) as VernietigingStatus[];
export const UITVOERINGSRESULTATEN = Object.keys(uitvoeringsresultaten) as UitvoeringsresultaatWaarde[];

export type { SelectieStatus, UitvoeringsresultaatWaarde, VernietigingStatus };
export type StekkerSelectie = Selectie;
export type StekkerKandidaat = Vernietigingskandidaat;
export type StekkerKandidatenPagina = VernietigingskandidatenPagina;
export type StekkerVernietiging = Vernietigingsuitvoering;
export type StekkerUitvoeringsresultaat = Uitvoeringsresultaat;
export type StekkerBatchResultaat = BatchResultaat;

// Het deel van `stekker_configuratie` dat de client nodig heeft.
export type StekkerVerbinding = {
  id: string;
  baseUrl: string;
  authType: string;
  tokenUrl: string | null;
  clientId: string | null;
  secretRef: string | null;
  scopes: string[];
  timeouts: unknown;
};

export class StekkerFout extends Error {
  constructor(
    message: string,
    readonly details: {
      tijdelijk: boolean;
      status?: number;
      code?: string;
      correlatieId?: string;
      logReference?: string;
    }
  ) {
    super(message);
    this.name = "StekkerFout";
  }

  get tijdelijk() {
    return this.details.tijdelijk;
  }
}

type ClientOpties = {
  fetchFn?: typeof fetch;
  env?: Record<string, string | undefined>;
  now?: () => number;
  standaardTimeoutMs?: number;
};

type Verzoek = {
  methode: "GET" | "POST";
  pad: string;
  correlatieId: string;
  body?: unknown;
  idempotencyKey?: string;
};

const TOKEN_MARGE_MS = 30_000;

export class StekkerClient {
  private readonly fetchFn: typeof fetch;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => number;
  private readonly standaardTimeoutMs: number;
  private readonly tokens = new Map<string, { token: string; geldigTot: number }>();

  constructor(opties: ClientOpties = {}) {
    this.fetchFn = opties.fetchFn ?? fetch;
    this.env = opties.env ?? process.env;
    this.now = opties.now ?? Date.now;
    this.standaardTimeoutMs = opties.standaardTimeoutMs ?? 30_000;
  }

  async startSelectie(verbinding: StekkerVerbinding, peildatum: string | null, correlatieId: string) {
    const body = await this.verstuur(verbinding, {
      methode: "POST",
      pad: "/selecties",
      correlatieId,
      body: (peildatum ? { peildatum } : {}) satisfies SelectieStart,
    });
    return valideerSelectie(body);
  }

  async getSelectie(verbinding: StekkerVerbinding, selectieId: string, correlatieId: string) {
    const body = await this.verstuur(verbinding, {
      methode: "GET",
      pad: `/selecties/${encodeURIComponent(selectieId)}`,
      correlatieId,
    });
    return valideerSelectie(body);
  }

  async getKandidaten(
    verbinding: StekkerVerbinding,
    selectieId: string,
    pagina: { offset: number; limit: number },
    correlatieId: string
  ) {
    const body = await this.verstuur(verbinding, {
      methode: "GET",
      pad: `/selecties/${encodeURIComponent(selectieId)}/objecten?offset=${pagina.offset}&limit=${pagina.limit}`,
      correlatieId,
    });
    return valideerKandidatenPagina(body);
  }

  async startVernietiging(
    verbinding: StekkerVerbinding,
    body: VernietigingStart,
    idempotencyKey: string,
    correlatieId: string
  ) {
    const antwoord = await this.verstuur(verbinding, {
      methode: "POST",
      pad: "/vernietigingen",
      correlatieId,
      body,
      idempotencyKey,
    });
    return valideerVernietiging(antwoord);
  }

  async voegBatchToe(
    verbinding: StekkerVerbinding,
    vernietigingId: string,
    body: VernietigingBatch,
    idempotencyKey: string,
    correlatieId: string
  ) {
    const antwoord = await this.verstuur(verbinding, {
      methode: "POST",
      pad: `/vernietigingen/${encodeURIComponent(vernietigingId)}/batches`,
      correlatieId,
      body,
      idempotencyKey,
    });
    return valideerBatchResultaat(antwoord);
  }

  async geefVrij(
    verbinding: StekkerVerbinding,
    vernietigingId: string,
    body: VernietigingVrijgave,
    idempotencyKey: string,
    correlatieId: string
  ) {
    const antwoord = await this.verstuur(verbinding, {
      methode: "POST",
      pad: `/vernietigingen/${encodeURIComponent(vernietigingId)}/vrijgeven`,
      correlatieId,
      body,
      idempotencyKey,
    });
    return valideerVernietiging(antwoord);
  }

  async getVernietiging(verbinding: StekkerVerbinding, vernietigingId: string, correlatieId: string) {
    const antwoord = await this.verstuur(verbinding, {
      methode: "GET",
      pad: `/vernietigingen/${encodeURIComponent(vernietigingId)}`,
      correlatieId,
    });
    return valideerVernietiging(antwoord);
  }

  async getBatchResultaten(verbinding: StekkerVerbinding, vernietigingId: string, correlatieId: string) {
    const antwoord = await this.verstuur(verbinding, {
      methode: "GET",
      pad: `/vernietigingen/${encodeURIComponent(vernietigingId)}/batches`,
      correlatieId,
    });

    if (!Array.isArray(antwoord)) {
      throw contractFout("batchresultaten zijn geen lijst");
    }

    return antwoord.map(valideerBatchResultaat);
  }

  private async verstuur(verbinding: StekkerVerbinding, verzoek: Verzoek, opnieuwNa401 = true): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Correlation-ID": verzoek.correlatieId,
    };

    if (verzoek.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (verzoek.idempotencyKey) {
      headers["Idempotency-Key"] = verzoek.idempotencyKey;
    }

    const token = await this.token(verbinding, verzoek.correlatieId);

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.fetchMetTimeout(`${verbinding.baseUrl.replace(/\/$/, "")}${verzoek.pad}`, {
      method: verzoek.methode,
      headers,
      body: verzoek.body === undefined ? undefined : JSON.stringify(verzoek.body),
    }, timeoutVan(verbinding, this.standaardTimeoutMs));

    // Een verlopen of ingetrokken token: één keer opnieuw met een vers token.
    if (response.status === 401 && token && opnieuwNa401) {
      this.tokens.delete(verbinding.id);
      return this.verstuur(verbinding, verzoek, false);
    }

    const body = await leesJson(response);

    if (!response.ok) {
      throw foutUitResponse(response.status, body, `${verzoek.methode} ${verzoek.pad}`);
    }

    return body;
  }

  private async token(verbinding: StekkerVerbinding, correlatieId: string) {
    if (verbinding.authType === "none") {
      if (this.env.NODE_ENV === "production") {
        throw new StekkerFout("Stekkerauthenticatie 'none' is niet toegestaan in productie.", {
          tijdelijk: false,
          code: "CONFIGURATIE",
        });
      }

      return undefined;
    }

    if (verbinding.authType !== "oauth2_cc") {
      throw new StekkerFout(`Onbekend authType '${verbinding.authType}'.`, { tijdelijk: false, code: "CONFIGURATIE" });
    }

    const gecachet = this.tokens.get(verbinding.id);

    if (gecachet && gecachet.geldigTot > this.now()) {
      return gecachet.token;
    }

    const secret = verbinding.secretRef ? this.env[verbinding.secretRef] : undefined;

    if (!verbinding.tokenUrl || !verbinding.clientId || !secret) {
      throw new StekkerFout(
        `OAuth2-configuratie onvolledig (tokenUrl, clientId of secret via '${verbinding.secretRef ?? "?"}' ontbreekt).`,
        { tijdelijk: false, code: "CONFIGURATIE" }
      );
    }

    const response = await this.fetchMetTimeout(verbinding.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "X-Correlation-ID": correlatieId,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: verbinding.clientId,
        client_secret: secret,
        ...(verbinding.scopes.length > 0 ? { scope: verbinding.scopes.join(" ") } : {}),
      }).toString(),
    }, timeoutVan(verbinding, this.standaardTimeoutMs));

    const body = (await leesJson(response)) as { access_token?: unknown; expires_in?: unknown } | null;

    if (!response.ok || typeof body?.access_token !== "string") {
      // Een geweigerd client-secret is definitief; een onbereikbare IdP tijdelijk.
      throw new StekkerFout(`Token ophalen mislukt (HTTP ${response.status}).`, {
        tijdelijk: response.status >= 500 || response.status === 429,
        status: response.status,
        code: "TOKEN",
      });
    }

    const looptijdMs = typeof body.expires_in === "number" ? body.expires_in * 1000 : 60_000;
    this.tokens.set(verbinding.id, {
      token: body.access_token,
      geldigTot: this.now() + Math.max(0, looptijdMs - TOKEN_MARGE_MS),
    });

    return body.access_token;
  }

  private async fetchMetTimeout(url: string, init: RequestInit, timeoutMs: number) {
    try {
      return await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new StekkerFout(
        timeout ? `Geen antwoord binnen ${timeoutMs} ms.` : `Stekker onbereikbaar: ${netwerkOorzaak(error)}.`,
        { tijdelijk: true, code: timeout ? "TIMEOUT" : "NETWERK" }
      );
    }
  }
}

function timeoutVan(verbinding: StekkerVerbinding, standaard: number) {
  const timeouts = verbinding.timeouts as { requestMs?: unknown } | null;
  return typeof timeouts?.requestMs === "number" && timeouts.requestMs > 0 ? timeouts.requestMs : standaard;
}

async function leesJson(response: Response) {
  const tekst = await response.text();

  if (!tekst) {
    return null;
  }

  try {
    return JSON.parse(tekst) as unknown;
  } catch {
    if (response.ok) {
      throw contractFout("response is geen JSON");
    }

    return null;
  }
}

function foutUitResponse(status: number, body: unknown, omschrijving: string) {
  const fout = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const tekst = (waarde: unknown) => (typeof waarde === "string" ? waarde : undefined);
  const code = tekst(fout.code);

  return new StekkerFout(`${omschrijving}: HTTP ${status}${code ? ` ${code}` : ""}.`, {
    tijdelijk: status >= 500 || status === 429,
    status,
    code,
    correlatieId: tekst(fout.correlatieId),
    logReference: tekst(fout.logReference),
  });
}

function netwerkOorzaak(error: unknown) {
  const oorzaak = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
  return typeof oorzaak?.code === "string" ? oorzaak.code : error instanceof Error ? error.message : "onbekend";
}

function contractFout(reden: string) {
  return new StekkerFout(`Contractfout: ${reden}.`, { tijdelijk: false, code: "CONTRACT" });
}

function object(waarde: unknown, wat: string) {
  if (!waarde || typeof waarde !== "object" || Array.isArray(waarde)) {
    throw contractFout(`${wat} is geen object`);
  }

  return waarde as Record<string, unknown>;
}

function verplichteTekst(bron: Record<string, unknown>, veld: string, wat: string) {
  const waarde = bron[veld];

  if (typeof waarde !== "string" || waarde.trim() === "") {
    throw contractFout(`${wat} mist verplicht veld ${veld}`);
  }

  return waarde;
}

function enumWaarde<T extends string>(bron: Record<string, unknown>, veld: string, toegestaan: readonly T[], wat: string) {
  const waarde = bron[veld];

  if (typeof waarde !== "string" || !toegestaan.includes(waarde as T)) {
    throw contractFout(`${wat}.${veld} '${String(waarde)}' staat niet in de spec (${toegestaan.join(", ")})`);
  }

  return waarde as T;
}

export function valideerSelectie(waarde: unknown): StekkerSelectie {
  const selectie = object(waarde, "Selectie");
  verplichteTekst(selectie, "selectieId", "Selectie");
  enumWaarde(selectie, "status", SELECTIE_STATUSSEN, "Selectie");
  return selectie as StekkerSelectie;
}

export function valideerKandidatenPagina(waarde: unknown): StekkerKandidatenPagina {
  const pagina = object(waarde, "VernietigingskandidatenPagina");
  verplichteTekst(pagina, "selectieId", "VernietigingskandidatenPagina");

  if (!Array.isArray(pagina.items)) {
    throw contractFout("VernietigingskandidatenPagina mist verplicht veld items");
  }

  for (const item of pagina.items) {
    const kandidaat = object(item, "Vernietigingskandidaat");
    verplichteTekst(kandidaat, "vernietigingskandidaatId", "Vernietigingskandidaat");
    verplichteTekst(kandidaat, "bronId", "Vernietigingskandidaat");
    verplichteTekst(kandidaat, "omschrijving", "Vernietigingskandidaat");
  }

  return pagina as StekkerKandidatenPagina;
}

export function valideerVernietiging(waarde: unknown): StekkerVernietiging {
  const vernietiging = object(waarde, "Vernietigingsuitvoering");
  verplichteTekst(vernietiging, "vernietigingId", "Vernietigingsuitvoering");
  verplichteTekst(vernietiging, "selectieId", "Vernietigingsuitvoering");
  enumWaarde(vernietiging, "status", VERNIETIGING_STATUSSEN, "Vernietigingsuitvoering");
  return vernietiging as StekkerVernietiging;
}

export function valideerBatchResultaat(waarde: unknown): StekkerBatchResultaat {
  const batch = object(waarde, "BatchResultaat");

  if (!Number.isInteger(batch.batchNummer) || (batch.batchNummer as number) < 1) {
    throw contractFout("BatchResultaat mist een geldig batchNummer");
  }

  if (!Array.isArray(batch.resultaten)) {
    throw contractFout("BatchResultaat mist verplicht veld resultaten");
  }

  for (const item of batch.resultaten) {
    const resultaat = object(item, "Uitvoeringsresultaat");
    verplichteTekst(resultaat, "vernietigingskandidaatId", "Uitvoeringsresultaat");
    verplichteTekst(resultaat, "bronId", "Uitvoeringsresultaat");
    enumWaarde(resultaat, "resultaat", UITVOERINGSRESULTATEN, "Uitvoeringsresultaat");
  }

  return batch as StekkerBatchResultaat;
}
