import type { AuditActor } from "../audit/audit-keten.js";
import { StekkerFout, type StekkerVerbinding } from "../stekker/stekker-client.js";
import type { bepaalVervolg } from "./retrybeleid.js";

// Hulpfuncties die de selectie- en uitvoeringsverwerking delen.

export const SYSTEEM: AuditActor = { type: "system", naam: "Vernietigingscockpit-worker" };

export function jobVerwerkt(pogingen: number) {
  return { status: "VERWERKT", pogingen: pogingen + 1, verzondenOp: new Date(), laatsteFout: null };
}

export function jobNaFout(pogingen: number, vervolg: ReturnType<typeof bepaalVervolg>, melding: string) {
  return vervolg.status === "OPEN"
    ? { status: "OPEN", pogingen: pogingen + 1, volgendePogingOp: vervolg.volgendePogingOp, laatsteFout: melding }
    : { status: "MISLUKT", pogingen: pogingen + 1, verzondenOp: new Date(), laatsteFout: melding };
}

export function vervolgToelichting(vervolg: ReturnType<typeof bepaalVervolg>) {
  return vervolg.status === "OPEN"
    ? ` ${vervolg.toelichting} Nieuwe poging om ${vervolg.volgendePogingOp.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam" })}.`
    : ` ${vervolg.toelichting} Opnieuw starten kan via de cockpit.`;
}

export function isVernietigingAfgerond(status: string) {
  return status === "COMPLETED" || status === "PARTIAL" || status === "FAILED";
}

// Alleen de velden die de client nodig heeft; het secret zelf staat in env (secret_ref).
export function verbindingVan(configuratie: StekkerVerbinding): StekkerVerbinding {
  return {
    id: configuratie.id,
    baseUrl: configuratie.baseUrl,
    authType: configuratie.authType,
    tokenUrl: configuratie.tokenUrl,
    clientId: configuratie.clientId,
    secretRef: configuratie.secretRef,
    secretVersleuteld: configuratie.secretVersleuteld ?? null,
    scopes: configuratie.scopes,
    timeouts: configuratie.timeouts,
  };
}

// X-Correlation-ID per taak en job, zodat een call bij de stekker terug te vinden is.
export function correlatieId(taakinstantieId: string | null, job: string) {
  return `${taakinstantieId ?? "zonder-taak"}:${job}`;
}

export function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function describeError(error: unknown) {
  if (error instanceof StekkerFout) {
    const verwijzingen = [error.details.correlatieId, error.details.logReference].filter(Boolean);
    return verwijzingen.length > 0 ? `${error.message} (stekker: ${verwijzingen.join(", ")})` : error.message;
  }

  if (error instanceof Error) {
    const cause = formatErrorCause(error.cause);

    return cause ? `${error.message}: ${cause}` : error.message;
  }

  return "Onbekende fout.";
}

function formatErrorCause(cause: unknown): string | null {
  if (!cause) {
    return null;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "object") {
    const details = cause as {
      code?: unknown;
      errno?: unknown;
      syscall?: unknown;
      address?: unknown;
      port?: unknown;
      message?: unknown;
    };
    const parts = [
      details.code,
      details.errno,
      details.syscall,
      details.address,
      details.port,
      details.message,
    ]
      .filter((part): part is string | number => {
        return typeof part === "string" || typeof part === "number";
      })
      .map(String);

    return parts.length > 0 ? parts.join(" ") : JSON.stringify(cause);
  }

  return String(cause);
}

// Gestructureerde logregel (CC-15) met dezelfde correlatie-id als in X-Correlation-ID naar
// de stekker, zodat een fout in beide logs terug te vinden is.
export function logRegel(melding: string, job: { id: string; taakinstantieId: string | null }) {
  return { msg: melding, correlatie_id: correlatieId(job.taakinstantieId, job.id), job_id: job.id };
}
