import { gunzipSync } from "node:zlib";
import { ConfigService } from "@nestjs/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { PrismaService } from "../../src/shared/db/prisma.service.js";

// Gedeelde hulpfuncties voor de E2E-tests. Vereisen de omgeving uit
// infrastructure/compose/docker-compose.test.yml (npm run test:e2e).
export const API = process.env.E2E_API_URL ?? "http://localhost:39700/api/v1";
const IDP = process.env.E2E_IDP_URL ?? "http://localhost:39701";
// Geheimen uit de omgeving (scripts/e2e.mjs geeft ze mee) of, bij een losse vitest-run,
// uit infrastructure/compose/.env (niet in git).
const geheimen = leesE2eGeheimen();
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://cockpit:${geheimen.E2E_DB_WACHTWOORD}@localhost:55433/cockpit?schema=public&sslmode=disable`;
export const STEKKER_GEHEIM = geheimen.E2E_STEKKER_GEHEIM;

export const prisma = new PrismaService(new ConfigService({ DATABASE_URL }));

export type Rol = "rm" | "po" | "arch" | "auditor" | "beheer";
// De nep-IdP geeft tokens van 300 s; na 240 s een nieuw token (lange tests, zoals scenario F).
const tokens: Partial<Record<Rol, { token: string; tot: number }>> = {};
const gebruikers: Record<Rol, { username: string; rol: string }> = {
  rm: { username: "rm1", rol: "recordmanager" },
  po: { username: "po1", rol: "proceseigenaar" },
  arch: { username: "arch1", rol: "archivaris" },
  auditor: { username: "auditor1", rol: "auditor" },
  beheer: { username: "fb1", rol: "functioneel_beheerder" },
};

export async function token(wie: Rol) {
  let bewaard = tokens[wie];
  if (!bewaard || bewaard.tot < Date.now()) {
    const { username, rol } = gebruikers[wie];
    const response = await fetch(`${IDP}/test/gebruikerstoken`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, roles: [rol], email: `${username}@example.test` }),
    });
    bewaard = { token: ((await response.json()) as { access_token: string }).access_token, tot: Date.now() + 240_000 };
    tokens[wie] = bewaard;
  }

  return bewaard.token;
}

export async function api(
  wie: Rol,
  pad: string,
  init: { method?: string; body?: unknown; ifMatch?: string } = {}
) {
  const response = await fetch(`${API}${pad}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${await token(wie)}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.ifMatch !== undefined ? { "if-match": init.ifMatch } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  // any: de tests lezen wisselende API-responses uit; de vorm wordt per stap met expect getoetst.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    status: response.status,
    etag: response.headers.get("etag"),
    body: (await response.json().catch(() => null)) as any,
  };
}

// Statuswijziging zoals de web-app die doet: eerst de taak (en de ETag) laden, dan met If-Match.
export async function statuswijziging(wie: Rol, taakId: string, actiepad: string) {
  const { etag } = await api(wie, `/taken/${taakId}`);
  return api(wie, `/taken/${taakId}/${actiepad}`, { method: "POST", ifMatch: etag ?? undefined });
}

export async function wachtOp<T>(omschrijving: string, ophalen: () => Promise<T>, klaar: (waarde: T) => boolean, maxMs = 60_000) {
  const start = Date.now();
  let laatste = await ophalen();

  while (!klaar(laatste)) {
    if (Date.now() - start > maxMs) {
      throw new Error(`${omschrijving}: niet bereikt binnen ${maxMs} ms (laatste: ${JSON.stringify(laatste).slice(0, 300)})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    laatste = await ophalen();
  }

  return laatste;
}

// Medewerkers (eenmalig), plus per aanroep een eigen stekker, taakdefinitie en taakinstantie.
// `timeouts` zoals in stekker_configuratie (standaard requestMs 10 s).
export async function maakTaak(naam: string, stekkerBaseUrl: string, timeouts: Record<string, number> = { requestMs: 10_000 }) {
  const db = prisma.client;
  const medewerker = (volledigeNaam: string, externId: string, rol: "recordmanager" | "proceseigenaar" | "archivaris") =>
    db.medewerker.upsert({
      where: { email: `${externId}@example.test` },
      update: {},
      create: {
        naam: volledigeNaam,
        email: `${externId}@example.test`,
        rollen: [rol],
        bron: "e2e",
        externId,
        ...(rol === "proceseigenaar" ? { archiefvormer: { verwijzingNaam: "Gemeente E2E" } } : {}),
      },
    });

  const rm = await medewerker("Rita Recordmanager", "rm1", "recordmanager");
  const po = await medewerker("Peter Proceseigenaar", "po1", "proceseigenaar");
  const arch = await medewerker("Anna Archivaris", "arch1", "archivaris");

  const stekker = await db.stekker.create({ data: { naam } });
  await db.stekkerConfiguratie.create({
    data: {
      stekkerId: stekker.id,
      versie: 1,
      baseUrl: stekkerBaseUrl,
      authType: "oauth2_cc",
      tokenUrl: "http://idp:8080/realms/vc/protocol/openid-connect/token",
      clientId: "cockpit-stekker",
      secretRef: "STEKKER_SECRET",
      scopes: ["selectie.read", "selectie.write", "vernietiging.read", "vernietiging.write"],
      parameters: {},
      verwachteApiMajor: 2,
      timeouts,
      aangemaaktDoor: "e2e",
    },
  });
  const definitie = await db.taakdefinitie.create({
    data: {
      naam,
      categorie: "Sociaal domein",
      frequentie: "ad_hoc",
      recordmanagerId: rm.id,
      proceseigenaarId: po.id,
      archivarisId: arch.id,
      stekkers: { create: { stekkerId: stekker.id, selectieparameters: {} } },
    },
  });
  // Via de API, zodat de auditketen van de taak met Creatie begint.
  const taak = await api("rm", `/taakdefinities/${definitie.id}/instanties`, {
    method: "POST",
    body: { naam, peildatum: "2026-01-01" },
  });
  if (taak.status !== 201) {
    throw new Error(`Taak aanmaken mislukt: HTTP ${taak.status} ${JSON.stringify(taak.body)}`);
  }

  return { taakId: taak.body.id as string, stekkerId: stekker.id };
}

// Eventtypen uit het auditlog van een taak, in volgorde (alle pagina's).
export async function auditActies(taakId: string) {
  const acties: string[] = [];
  for (let pagina = 1; ; pagina += 1) {
    const { body } = await api("rm", `/taken/${taakId}/auditlog?pagina=${pagina}&perPagina=200`);
    acties.push(...body.items.map((item: { eventType: string }) => item.eventType));
    if (acties.length >= body.totaal) {
      return acties;
    }
  }
}

// Selectie, beoordeling (eerste `uitsluiten` kandidaten uitgesloten) en beide accorderingen.
export async function totVrijgegeven(taakId: string, uitsluiten = 0) {
  await api("rm", `/taken/${taakId}/selectie`, { method: "POST", body: {} });
  await wachtOp("taak naar beoordeling", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "beoordeling");

  const { body } = await api("rm", `/taken/${taakId}/kandidaten`);
  for (const [index, kandidaat] of body.kandidaten.entries()) {
    await api("rm", `/taken/${taakId}/kandidaten/${kandidaat.id}/beoordeling`, {
      method: "PATCH",
      body:
        index < uitsluiten
          ? { beoordeling: "UITGESLOTEN", uitsluitReden: "Lopend verzoek of procedure", toelichting: "E2E: lopende bezwaarprocedure" }
          : { beoordeling: "AKKOORD" },
    });
  }

  await statuswijziging("rm", taakId, "beoordeling/voorleggen");
  await statuswijziging("po", taakId, "accordering/proceseigenaar/besluiten");
  const vrijgave = await statuswijziging("arch", taakId, "accordering/archivaris/besluiten");

  return { aantalKandidaten: body.kandidaten.length as number, status: vrijgave.body?.status as string };
}

// Rechtstreeks bij de stekker kijken wat daar werkelijk is vastgelegd.
export async function stekkerGet(baseUrl: string, pad: string) {
  const token = await fetch(`${IDP}/realms/vc/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "cockpit-stekker",
      client_secret: STEKKER_GEHEIM,
      scope: "vernietiging.read",
    }),
  }).then((antwoord) => antwoord.json() as Promise<{ access_token: string }>);
  // Stekker API v2: alle paden onder /v2.
  const antwoord = await fetch(`${baseUrl}/v2${pad}`, { headers: { authorization: `Bearer ${token.access_token}` } });
  expect(antwoord.status, `${pad}`).toBe(200);
  return antwoord.json();
}

export async function controleerBijStekker(stekkerUrl: string, taakId: string, aantalKandidaten: number) {
  const uitvoering = await api("rm", `/taken/${taakId}/uitvoering`);
  const externId = uitvoering.body.stekkers[0].externVernietigingId as string;
  const lijst = (await stekkerGet(stekkerUrl, `/vernietigingen/${externId}/batches`)) as Array<{
    batchNummer: number;
    resultaten: Array<{ vernietigingskandidaatId: string }>;
  }>;
  const kandidaten = lijst.flatMap((batch) => batch.resultaten.map((resultaat) => resultaat.vernietigingskandidaatId));

  expect(lijst.map((batch) => batch.batchNummer)).toEqual(
    Array.from({ length: Math.ceil(aantalKandidaten / 100) }, (_, i) => i + 1)
  );
  expect(kandidaten).toHaveLength(aantalKandidaten);
  expect(new Set(kandidaten).size).toBe(aantalKandidaten);

  // En in de cockpit: elke kandidaat precies één resultaat, en één audit-event per object.
  const regels = await prisma.client.uitvoeringsresultaat.findMany({ where: { vernietiging: { taakinstantieId: taakId } } });
  expect(regels).toHaveLength(aantalKandidaten);
  expect(regels.every((regel) => regel.resultaat !== null)).toBe(true);

  // Stekker API v2 (ADR-0005): bij SUCCESS het event Vernietigen met tijdstip en een echte
  // MDTO-XML-specificatie; per uitvoering de vernietigingsmethode.
  for (const regel of regels.filter((r) => r.resultaat === "SUCCESS")) {
    expect(regel.eventTijd).toBeInstanceOf(Date);
    const xml = gunzipSync(Buffer.from(regel.specificatie!)).toString("utf8");
    expect(xml).toMatch(/<MDTO xmlns="https:\/\/www\.nationaalarchief\.nl\/mdto"/);
    expect(xml).toMatch(/<begripLabel>Vernietigen<\/begripLabel>/);
  }
  const vernietiging = await prisma.client.vernietiging.findFirstOrThrow({ where: { taakinstantieId: taakId } });
  expect(vernietiging.vernietigingsmethode).toMatchObject({ begripLabel: expect.any(String) });
  const objectEvents = await prisma.client.auditEvent.count({
    where: { taakinstantieId: taakId, eventType: { in: ["Vernietigen", "Niet vernietigd"] } },
  });
  expect(objectEvents).toBe(aantalKandidaten);
  expect(uitvoering.body.stekkers[0]).toMatchObject({ vernietigingStatus: "COMPLETED", fout: null });
}

function leesE2eGeheimen() {
  const sleutels = ["E2E_DB_WACHTWOORD", "E2E_STEKKER_GEHEIM"] as const;
  const bestand = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../infrastructure/compose/.env");
  const uitBestand: Record<string, string> = {};

  if (existsSync(bestand)) {
    for (const regel of readFileSync(bestand, "utf8").split(/\r?\n/)) {
      const [, sleutel, waarde] = /^([A-Z0-9_]+)=(.*)$/.exec(regel) ?? [];
      if (sleutel) {
        uitBestand[sleutel] = waarde;
      }
    }
  }

  const waarden = Object.fromEntries(sleutels.map((sleutel) => [sleutel, process.env[sleutel] ?? uitBestand[sleutel]]));
  const ontbrekend = sleutels.filter((sleutel) => !waarden[sleutel]);

  if (ontbrekend.length > 0) {
    throw new Error(`${ontbrekend.join(", ")} ontbreekt; draai de E2E-tests via npm run test:e2e (maakt infrastructure/compose/.env).`);
  }

  return waarden as Record<(typeof sleutels)[number], string>;
}
