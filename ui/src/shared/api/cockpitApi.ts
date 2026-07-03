import type { VernietigingsObject } from "../types/destruction";
import type { DestructionResultRow } from "../types/destructionResult";
import { reviewRows } from "../mocks/reviewRows";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type ListResponse<T> = {
  items: T[];
  total: number;
};

type ActieStatus = {
  actieId: string;
  status: "geaccepteerd" | "gepland" | "afgewezen";
  bericht: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function startSelectie(taakId: string, taakuitvoeringId: string) {
  return request<ActieStatus>(
    `/taken/${taakId}/taakuitvoeringen/${taakuitvoeringId}/selectie`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export function listReviewRows(taakId: string, taakuitvoeringId: string) {
  return request<ListResponse<VernietigingsObject>>(
    `/taken/${taakId}/taakuitvoeringen/${taakuitvoeringId}/reviewregels`
  ).catch(() => ({
    items: reviewRows.map((row) => ({ ...row })),
    total: reviewRows.length,
  }));
}

export function markReviewRowsReviewed(
  taakId: string,
  taakuitvoeringId: string,
  reviewregelIds: string[]
) {
  return request(`/taken/${taakId}/taakuitvoeringen/${taakuitvoeringId}/reviewregels/markeer-beoordeeld`, {
    method: "POST",
    body: JSON.stringify({ reviewregelIds }),
  }).catch(() => ({
    taakId,
    taakuitvoeringId,
    items: reviewregelIds.map((reviewregelId) => ({
      reviewregelId,
      status: "beoordeeld",
    })),
  }));
}

export function listDestructionResults(taakId: string, taakuitvoeringId: string) {
  return request<ListResponse<DestructionResultRow>>(
    `/taken/${taakId}/taakuitvoeringen/${taakuitvoeringId}/resultaatregels`
  );
}
