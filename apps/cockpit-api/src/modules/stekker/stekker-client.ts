// Eén client voor alle communicatie met stekkers, volgens de Stekker-OpenAPI-spec
// (v2.0.0, MDTO; ADR-0005). De cockpit bevat geen stekkerspecifieke code: verschillen
// tussen stekkers zitten uitsluitend in de stekkerconfiguratie.
//
// - Paden staan onder /v{major} (API-20); elke geslaagde response moet de header
//   API-Version met dezelfde major hebben (API-57). Alleen major 2 wordt ondersteund.
// - Elke POST heeft een Idempotency-Key (ADR-0004).
// - Authenticatie: OAuth2 client credentials (token gecachet per configuratieversie),
//   of 'none' (alleen buiten productie).
// - Elke call heeft een time-out en een X-Correlation-ID.
// - Responses worden strikt getoetst aan de spec; afwijkingen zijn contractfouten.
// - Elke fout is een StekkerFout met `tijdelijk`: true bij 5xx, 429, time-out en
//   netwerkfouten (opnieuw proberen zinvol), false bij 4xx en contractfouten.

import { GeheimFout, leesSleutel, ontsleutel } from "../../shared/geheim/geheim.js";
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
  // Versleuteld secret uit stekkerbeheer; heeft voorrang op secretRef.
  secretVersleuteld?: string | null;
  scopes: string[];
  timeouts: unknown;
  // Major versie van de Stekker API (stekker_configuratie.verwachte_api_major).
  verwachteApiMajor: number;
};

// Ondersteunde major versies van de Stekker API.
export const ONDERSTEUNDE_API_MAJORS = [2];

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
  // Verwacht antwoordtype; standaard JSON.
  xml?: boolean;
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

  async startSelectie(verbinding: StekkerVerbinding, peildatum: string | null, idempotencyKey: string, correlatieId: string) {
    const body = await this.verstuur(verbinding, {
      methode: "POST",
      pad: "/selecties",
      correlatieId,
      body: (peildatum ? { peildatum } : {}) satisfies SelectieStart,
      idempotencyKey,
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
      pad: `/selecties/${encodeURIComponent(selectieId)}/vernietigingskandidaten?offset=${pagina.offset}&limit=${pagina.limit}`,
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

  // De MDTO-XML-specificatie van een vernietigde kandidaat (ADR-0005, B-M2).
  async getSpecificatie(verbinding: StekkerVerbinding, vernietigingId: string, kandidaatId: string, correlatieId: string) {
    const xml = await this.verstuur(verbinding, {
      methode: "GET",
      pad: `/vernietigingen/${encodeURIComponent(vernietigingId)}/specificaties/${encodeURIComponent(kandidaatId)}`,
      correlatieId,
      xml: true,
    });

    if (typeof xml !== "string" || !/<MDTO[\s>]/.test(xml)) {
      throw contractFout("specificatie is geen MDTO-XML");
    }

    return xml;
  }

  private async verstuur(verbinding: StekkerVerbinding, verzoek: Verzoek, opnieuwNa401 = true): Promise<unknown> {
    if (!ONDERSTEUNDE_API_MAJORS.includes(verbinding.verwachteApiMajor)) {
      throw new StekkerFout(
        `Stekker API v${verbinding.verwachteApiMajor} wordt niet ondersteund (wel: v${ONDERSTEUNDE_API_MAJORS.join(", v")}).`,
        { tijdelijk: false, code: "CONFIGURATIE" }
      );
    }

    const headers: Record<string, string> = {
      Accept: verzoek.xml ? "application/xml" : "application/json",
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

    const basis = `${verbinding.baseUrl.replace(/\/$/, "")}/v${verbinding.verwachteApiMajor}`;
    const response = await this.fetchMetTimeout(`${basis}${verzoek.pad}`, {
      method: verzoek.methode,
      headers,
      body: verzoek.body === undefined ? undefined : JSON.stringify(verzoek.body),
    }, timeoutVan(verbinding, this.standaardTimeoutMs));

    // Een verlopen of ingetrokken token: één keer opnieuw met een vers token.
    if (response.status === 401 && token && opnieuwNa401) {
      this.tokens.delete(verbinding.id);
      return this.verstuur(verbinding, verzoek, false);
    }

    if (!response.ok) {
      throw foutUitResponse(response.status, await leesJson(response).catch(() => null), `${verzoek.methode} ${verzoek.pad}`);
    }

    const apiVersie = response.headers.get("API-Version");

    if (!apiVersie || Number.parseInt(apiVersie, 10) !== verbinding.verwachteApiMajor) {
      throw contractFout(`API-Version '${apiVersie ?? "ontbreekt"}' past niet bij v${verbinding.verwachteApiMajor}`);
    }

    return verzoek.xml ? response.text() : leesJson(response);
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

    const secret = this.secretVan(verbinding);

    if (!verbinding.tokenUrl || !verbinding.clientId || !secret) {
      throw new StekkerFout(
        `OAuth2-configuratie onvolledig (tokenUrl, clientId of secret${verbinding.secretVersleuteld ? "" : ` via '${verbinding.secretRef ?? "?"}'`} ontbreekt).`,
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

  // Het secret: ontsleuteld uit stekkerbeheer, of uit de omgevingsvariabele in secretRef.
  private secretVan(verbinding: StekkerVerbinding) {
    if (verbinding.secretVersleuteld) {
      try {
        return ontsleutel(verbinding.secretVersleuteld, leesSleutel(this.env.SECRET_ENCRYPTION_KEY));
      } catch (error) {
        throw new StekkerFout(error instanceof GeheimFout ? error.message : "Secret ontsleutelen mislukt.", {
          tijdelijk: false,
          code: "CONFIGURATIE",
        });
      }
    }

    return verbinding.secretRef ? this.env[verbinding.secretRef] : undefined;
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
    valideerKandidaat(item);
  }

  return pagina as StekkerKandidatenPagina;
}

const AGGREGATIENIVEAUS = ["Archief", "Serie", "Dossier", "Archiefstuk"] as const;
const WAARDERINGSCODES = ["B", "V", "N"] as const;

// Verplichte velden van het MDTO-profiel (Stekker API v2). Ontbreekt er één, dan is de hele
// pagina een contractfout: liever geen import dan een kandidaat die niet te verantwoorden is.
function valideerKandidaat(item: unknown) {
  const wat = "Vernietigingskandidaat";
  const kandidaat = object(item, wat);
  verplichteTekst(kandidaat, "vernietigingskandidaatId", wat);
  verplichteTekst(kandidaat, "naam", wat);
  valideerIdentificatie(kandidaat, wat);
  enumWaarde(object(kandidaat.aggregatieniveau, `${wat}.aggregatieniveau`), "begripLabel", AGGREGATIENIVEAUS, `${wat}.aggregatieniveau`);
  enumWaarde(object(kandidaat.waardering, `${wat}.waardering`), "begripCode", WAARDERINGSCODES, `${wat}.waardering`);
  valideerDatum(object(kandidaat.bewaartermijn, `${wat}.bewaartermijn`), "termijnEinddatum", `${wat}.bewaartermijn`);
  verplichteTekst(object(kandidaat.informatiecategorie, `${wat}.informatiecategorie`), "begripLabel", `${wat}.informatiecategorie`);
  verplichteTekst(
    object(object(kandidaat.informatiecategorie, `${wat}.informatiecategorie`).begripBegrippenlijst, `${wat}.informatiecategorie.begripBegrippenlijst`),
    "verwijzingNaam",
    `${wat}.informatiecategorie.begripBegrippenlijst`
  );
}

function valideerIdentificatie(bron: Record<string, unknown>, wat: string) {
  const identificatie = bron.identificatie;

  if (!Array.isArray(identificatie) || identificatie.length === 0) {
    throw contractFout(`${wat} mist verplicht veld identificatie`);
  }

  for (const item of identificatie) {
    const gegevens = object(item, `${wat}.identificatie`);
    verplichteTekst(gegevens, "identificatieKenmerk", `${wat}.identificatie`);
    verplichteTekst(gegevens, "identificatieBron", `${wat}.identificatie`);
  }
}

function valideerDatum(bron: Record<string, unknown>, veld: string, wat: string) {
  const waarde = verplichteTekst(bron, veld, wat);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(waarde) || Number.isNaN(Date.parse(waarde))) {
    throw contractFout(`${wat}.${veld} '${waarde}' is geen datum`);
  }

  return waarde;
}

export function valideerVernietiging(waarde: unknown): StekkerVernietiging {
  const vernietiging = object(waarde, "Vernietigingsuitvoering");
  verplichteTekst(vernietiging, "vernietigingId", "Vernietigingsuitvoering");
  verplichteTekst(vernietiging, "selectieId", "Vernietigingsuitvoering");
  verplichteTekst(vernietiging, "cockpitTaakId", "Vernietigingsuitvoering");
  verplichteTekst(vernietiging, "besluitReferentie", "Vernietigingsuitvoering");
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
    valideerIdentificatie(resultaat, "Uitvoeringsresultaat");
    const waarde = enumWaarde(resultaat, "resultaat", UITVOERINGSRESULTATEN, "Uitvoeringsresultaat");

    // Bij SUCCESS is het event Vernietigen met tijdstip verplicht (Archiefbesluit art. 8).
    if (waarde === "SUCCESS") {
      const event = object(resultaat.event, "Uitvoeringsresultaat.event");
      const type = object(event.eventType, "Uitvoeringsresultaat.event.eventType");

      if (type.begripLabel !== "Vernietigen") {
        throw contractFout(`Uitvoeringsresultaat.event.eventType '${String(type.begripLabel)}' is niet Vernietigen`);
      }
      if (typeof event.eventTijd !== "string" || Number.isNaN(Date.parse(event.eventTijd))) {
        throw contractFout("Uitvoeringsresultaat.event mist een geldige eventTijd");
      }
    }
  }

  return batch as StekkerBatchResultaat;
}
