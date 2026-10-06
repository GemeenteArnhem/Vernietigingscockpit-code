import { getApiBaseUrl } from "../auth/authConfig";

export type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  accessToken?: string;
  headers?: HeadersInit;
};

// Melding bij 409/412 (CC-13): iemand anders heeft de taak intussen gewijzigd. De
// foutweergave toont hierbij een knop "Opnieuw laden" (zie ActieFoutmelding).
export const TAAK_GEWIJZIGD_MELDING = "De taak is intussen gewijzigd door iemand anders.";

export class ApiFout extends Error {
  readonly status: number;
  // De melding van de server zelf (met veldfouten bij 400), ook als `message` een
  // standaardtekst is (409/412 op de taakschermen).
  readonly serverMelding: string | null;

  constructor(message: string, status: number, serverMelding: string | null = null) {
    super(message);
    this.name = "ApiFout";
    this.status = status;
    this.serverMelding = serverMelding;
  }
}

// Stil vernieuwen van het token bij een 401 (CC-13). De AuthProvider registreert hier
// de vernieuwing (signinSilent); zonder login (ontwikkelmodus) is er geen.
type TokenVernieuwer = () => Promise<string | undefined>;
let tokenVernieuwer: TokenVernieuwer | null = null;

export function registreerTokenVernieuwer(vernieuwer: TokenVernieuwer | null) {
  tokenVernieuwer = vernieuwer;
}

async function verstuur(path: string, options: ApiRequestOptions) {
  const { accessToken, headers, ...requestOptions } = options;
  const doe = (token: string | undefined) => {
    const requestHeaders = new Headers(headers);

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    return fetch(`${getApiBaseUrl()}${path}`, { ...requestOptions, headers: requestHeaders });
  };

  const response = await doe(accessToken);

  // Verlopen token: één keer stil vernieuwen en het verzoek herhalen.
  if (response.status === 401 && accessToken && tokenVernieuwer) {
    const nieuw = await tokenVernieuwer().catch(() => undefined);

    if (nieuw && nieuw !== accessToken) {
      return doe(nieuw);
    }
  }

  return response;
}

async function foutVan(path: string, response: Response) {
  let serverMelding: string | null = null;

  try {
    const details = (await response.json()) as { message?: unknown; fouten?: unknown };

    if (typeof details.message === "string") {
      serverMelding = details.message;
    } else if (Array.isArray(details.message)) {
      serverMelding = details.message.join(" ");
    }

    if (Array.isArray(details.fouten) && details.fouten.length > 0) {
      const velden = (details.fouten as Array<{ veld?: unknown; melding?: unknown }>)
        .map((fout) => `${String(fout.veld ?? "")}: ${String(fout.melding ?? "")}`)
        .join("; ");
      serverMelding = `${serverMelding ?? "Ongeldige invoer."} (${velden})`;
    }
  } catch {
    // Keep the generic response status when the API does not return JSON.
  }

  if (response.status === 409 || response.status === 412) {
    return new ApiFout(TAAK_GEWIJZIGD_MELDING, response.status, serverMelding);
  }

  return new ApiFout(serverMelding ?? `API request ${path} failed with ${response.status}`, response.status, serverMelding);
}

// Melding voor schermen buiten de taakworkflow (bijv. stekkerbeheer): de tekst van de server.
export function serverFoutmelding(fout: unknown, standaard: string) {
  if (fout instanceof ApiFout) {
    return fout.serverMelding ?? fout.message;
  }
  return fout instanceof Error ? fout.message : standaard;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const response = await verstuur(path, options);

  if (!response.ok) {
    throw await foutVan(path, response);
  }

  // 204 No Content (bijv. verwijderen): geen body.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiDownload(
  path: string,
  options: ApiRequestOptions = {}
) {
  const response = await verstuur(path, options);

  if (!response.ok) {
    throw new ApiFout(`Download ${path} failed with ${response.status}`, response.status);
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromDisposition(
      response.headers.get("Content-Disposition")
    ),
  };
}

function getFilenameFromDisposition(disposition: string | null) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);

  return match?.[1] ?? null;
}
