import { getApiBaseUrl } from "../auth/authConfig";

export type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  accessToken?: string;
  headers?: HeadersInit;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { accessToken, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
  });

  if (!response.ok) {
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

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function apiDownload(
  path: string,
  options: ApiRequestOptions = {}
) {
  const { accessToken, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
  });

  if (!response.ok) {
    throw new Error(`Download ${path} failed with ${response.status}`);
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
