import { describe, expect, it } from "vitest";
import { StekkerFout } from "../stekker/stekker-client.js";
import { backoffMs, bepaalVervolg, leesRetryConfig } from "./retrybeleid.js";

const config = { maxPogingen: 8, backoffStartMs: 5_000, backoffMaxMs: 600_000 };
const nu = new Date("2026-10-02T12:00:00Z");
const tijdelijk = new StekkerFout("POST /vernietigingen: HTTP 503.", { tijdelijk: true, status: 503 });
const definitief = new StekkerFout("POST /vernietigingen: HTTP 403 FORBIDDEN.", { tijdelijk: false, status: 403 });

describe("leesRetryConfig", () => {
  it("gebruikt de standaardwaarden zonder of met ongeldige env", () => {
    expect(leesRetryConfig(() => undefined)).toEqual(config);
    expect(leesRetryConfig(() => "nul")).toEqual(config);
  });

  it("neemt geldige env-waarden over", () => {
    const env: Record<string, string> = { WORKER_MAX_POGINGEN: "3", WORKER_BACKOFF_START_MS: "500", WORKER_BACKOFF_MAX_MS: "2000" };
    expect(leesRetryConfig((sleutel) => env[sleutel])).toEqual({ maxPogingen: 3, backoffStartMs: 500, backoffMaxMs: 2000 });
  });
});

describe("backoffMs", () => {
  it("verdubbelt per poging en is begrensd door het maximum", () => {
    expect([1, 2, 3, 4, 7, 8, 20].map((poging) => backoffMs(poging, config))).toEqual([
      5_000, 10_000, 20_000, 40_000, 320_000, 600_000, 600_000,
    ]);
  });
});

describe("bepaalVervolg", () => {
  it("probeert een tijdelijke fout opnieuw met backoff", () => {
    const vervolg = bepaalVervolg(tijdelijk, 2, config, nu);
    expect(vervolg).toMatchObject({ status: "OPEN", volgendePogingOp: new Date("2026-10-02T12:00:10Z") });
    expect(vervolg.toelichting).toBe("Poging 2 van 8.");
  });

  it("geeft een tijdelijke fout op na het maximum aantal pogingen", () => {
    expect(bepaalVervolg(tijdelijk, 8, config, nu)).toEqual({ status: "MISLUKT", toelichting: "Opgegeven na 8 pogingen." });
  });

  it("probeert een definitieve fout nooit opnieuw, ook niet bij de eerste poging", () => {
    expect(bepaalVervolg(definitief, 1, config, nu)).toEqual({
      status: "MISLUKT",
      toelichting: "Niet opnieuw geprobeerd: de fout is niet tijdelijk.",
    });
  });

  it("behandelt een onverwachte fout als tijdelijk", () => {
    expect(bepaalVervolg(new Error("database even weg"), 1, config, nu).status).toBe("OPEN");
  });
});
