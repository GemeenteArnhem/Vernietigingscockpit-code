import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiFout,
  TAAK_GEWIJZIGD_MELDING,
  apiDownload,
  apiRequest,
  registreerTokenVernieuwer,
  serverFoutmelding,
} from "./apiClient";

function antwoord(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function nepFetch(...antwoorden: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const a of antwoorden) {
    fetch.mockResolvedValueOnce(a);
  }
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  registreerTokenVernieuwer(null);
});

describe("apiRequest", () => {
  it("roept de API aan onder /api/v1 met het token als Bearer", async () => {
    const fetch = nepFetch(antwoord(200, { ok: true }));

    await expect(apiRequest("/me", { accessToken: "abc" })).resolves.toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("/api/v1/me");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer abc");
  });

  it("geeft undefined terug bij 204 No Content", async () => {
    nepFetch(antwoord(204));

    await expect(apiRequest("/beheer/stekkers/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("geeft de servermelding door, met veldfouten bij 400", async () => {
    nepFetch(antwoord(400, { message: "Ongeldige invoer.", fouten: [{ veld: "naam", melding: "is verplicht" }] }));

    const fout = await apiRequest("/taakdefinities").catch((e: unknown) => e);

    expect(fout).toBeInstanceOf(ApiFout);
    expect((fout as ApiFout).status).toBe(400);
    expect((fout as ApiFout).message).toBe("Ongeldige invoer. (naam: is verplicht)");
  });

  it("voegt een lijst met meldingen samen", async () => {
    nepFetch(antwoord(400, { message: ["naam ontbreekt", "categorie ontbreekt"] }));

    await expect(apiRequest("/taakdefinities")).rejects.toThrow("naam ontbreekt categorie ontbreekt");
  });

  it.each([409, 412])("geeft bij %i de vaste melding dat de taak is gewijzigd", async (status) => {
    nepFetch(antwoord(status, { message: "Versie klopt niet" }));

    const fout = (await apiRequest("/taken/1/beoordeling/voorleggen").catch((e: unknown) => e)) as ApiFout;

    expect(fout.message).toBe(TAAK_GEWIJZIGD_MELDING);
    expect(fout.serverMelding).toBe("Versie klopt niet");
  });

  it("valt terug op een algemene melding als het antwoord geen JSON is", async () => {
    nepFetch(new Response("stuk", { status: 500 }));

    await expect(apiRequest("/taken")).rejects.toThrow("API request /taken failed with 500");
  });

  it("vernieuwt het token één keer bij 401 en herhaalt het verzoek", async () => {
    const fetch = nepFetch(antwoord(401), antwoord(200, { ok: true }));
    registreerTokenVernieuwer(async () => "nieuw");

    await expect(apiRequest("/me", { accessToken: "oud" })).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(fetch.mock.calls[1]![1]?.headers).get("Authorization")).toBe("Bearer nieuw");
  });

  it("herhaalt niet als vernieuwen geen nieuw token oplevert", async () => {
    const fetch = nepFetch(antwoord(401));
    registreerTokenVernieuwer(async () => {
      throw new Error("geen sessie");
    });

    await expect(apiRequest("/me", { accessToken: "oud" })).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("apiDownload", () => {
  it("geeft het bestand en de bestandsnaam uit Content-Disposition", async () => {
    nepFetch(new Response("pdf", { status: 200, headers: { "Content-Disposition": 'attachment; filename="verklaring.pdf"' } }));

    const { blob, filename } = await apiDownload("/taken/1/verklaring.pdf");

    expect(await blob.text()).toBe("pdf");
    expect(filename).toBe("verklaring.pdf");
  });

  it("geeft een ApiFout als het downloaden mislukt", async () => {
    nepFetch(antwoord(404));

    await expect(apiDownload("/taken/1/verklaring.pdf")).rejects.toMatchObject({ status: 404 });
  });
});

describe("serverFoutmelding", () => {
  it("geeft de servermelding van een ApiFout, anders de foutmelding of de standaardtekst", () => {
    expect(serverFoutmelding(new ApiFout("algemeen", 400, "van de server"), "standaard")).toBe("van de server");
    expect(serverFoutmelding(new ApiFout("algemeen", 400), "standaard")).toBe("algemeen");
    expect(serverFoutmelding(new Error("kapot"), "standaard")).toBe("kapot");
    expect(serverFoutmelding("iets", "standaard")).toBe("standaard");
  });
});
