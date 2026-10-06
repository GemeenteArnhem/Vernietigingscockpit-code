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

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiFout";
    this.status = status;
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
  if (response.status === 409 || response.status === 412) {
    return new ApiFout(TAAK_GEWIJZIGD_MELDING, response.status);
  }

  let message = `API request ${path} failed with ${response.status}`;

  try {
    const details = (await response.json()) as { message?: unknown };

    if (typeof details.message === "string") {
      message = details.message;
    } else if (Array.isArray(details.message)) {
      message = details.message.join(" ");
    }
  } catch {
    // Keep the generic response status when the API does not return JSON.
  }

  return new ApiFout(message, response.status);
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const response = await verstuur(path, options);

  if (!response.ok) {
    throw await foutVan(path, response);
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
