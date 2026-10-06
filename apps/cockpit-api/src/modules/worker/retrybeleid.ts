import { StekkerFout } from "../stekker/stekker-client.js";

// Retrybeleid voor stekker-jobs in de outbox (actielijst CC-2).
//
// - Tijdelijke fout (5xx, 429, time-out, netwerk): opnieuw, met exponentiële backoff,
//   tot het maximum aantal pogingen.
// - Definitieve fout (4xx, contract- of configuratiefout): direct MISLUKT, niet opnieuw.
// - Onverwachte fouten (geen StekkerFout, bijv. een databasefout) gelden als tijdelijk,
//   begrensd door hetzelfde maximum.

export type RetryConfig = {
  maxPogingen: number;
  backoffStartMs: number;
  backoffMaxMs: number;
};

// `toelichting` legt uit wat er met de job gebeurt; de foutmelding zelf voegt de worker toe.
export type Vervolg =
  | { status: "OPEN"; volgendePogingOp: Date; toelichting: string }
  | { status: "MISLUKT"; toelichting: string };

export function leesRetryConfig(get: (sleutel: string) => string | undefined): RetryConfig {
  return {
    maxPogingen: positiefGetal(get("WORKER_MAX_POGINGEN"), 8),
    backoffStartMs: positiefGetal(get("WORKER_BACKOFF_START_MS"), 5_000),
    backoffMaxMs: positiefGetal(get("WORKER_BACKOFF_MAX_MS"), 600_000),
  };
}

// Wachttijd vóór poging `poging + 1`: start × 2^(poging − 1), begrensd door het maximum.
export function backoffMs(poging: number, config: RetryConfig) {
  return Math.min(config.backoffStartMs * 2 ** Math.max(0, poging - 1), config.backoffMaxMs);
}

// `pogingen` is het aantal pogingen inclusief de zojuist mislukte.
export function bepaalVervolg(error: unknown, pogingen: number, config: RetryConfig, nu: Date): Vervolg {
  const tijdelijk = error instanceof StekkerFout ? error.tijdelijk : true;

  if (!tijdelijk) {
    return { status: "MISLUKT", toelichting: "Niet opnieuw geprobeerd: de fout is niet tijdelijk." };
  }

  if (pogingen >= config.maxPogingen) {
    return { status: "MISLUKT", toelichting: `Opgegeven na ${pogingen} pogingen.` };
  }

  return {
    status: "OPEN",
    volgendePogingOp: new Date(nu.getTime() + backoffMs(pogingen, config)),
    toelichting: `Poging ${pogingen} van ${config.maxPogingen}.`,
  };
}

function positiefGetal(waarde: string | undefined, standaard: number) {
  const getal = Number(waarde);
  return Number.isInteger(getal) && getal > 0 ? getal : standaard;
}
