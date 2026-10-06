import type { ApiStekkerBeheer, StekkerInvoer } from "@vernietigingscockpit/api-contract";
import { apiRequest } from "./apiClient";

// Stekkerbeheer door de functioneel beheerder (bouwplan §7.1). Bewerken stuurt de laatste
// configuratieversie mee als If-Match; is die intussen gewijzigd, dan weigert de API (412).
export type { ApiStekkerBeheer, StekkerInvoer };

const BASIS = "/beheer/stekkers";

export function getStekkersBeheer(accessToken: string) {
  return apiRequest<ApiStekkerBeheer[]>(BASIS, { accessToken });
}

export function getStekkerBeheer(accessToken: string, id: string) {
  return apiRequest<ApiStekkerBeheer>(`${BASIS}/${id}`, { accessToken });
}

export function maakStekker(accessToken: string, invoer: StekkerInvoer) {
  return apiRequest<ApiStekkerBeheer>(BASIS, {
    accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoer),
  });
}

export function bewerkStekker(accessToken: string, id: string, versie: number, invoer: StekkerInvoer) {
  return apiRequest<ApiStekkerBeheer>(`${BASIS}/${id}`, {
    accessToken,
    method: "PUT",
    headers: { "Content-Type": "application/json", "If-Match": `"${versie}"` },
    body: JSON.stringify(invoer),
  });
}

export function zetStekkerActief(accessToken: string, id: string, actief: boolean) {
  return apiRequest<ApiStekkerBeheer>(`${BASIS}/${id}/${actief ? "activeren" : "deactiveren"}`, {
    accessToken,
    method: "POST",
  });
}

export function verwijderStekker(accessToken: string, id: string) {
  return apiRequest<void>(`${BASIS}/${id}`, { accessToken, method: "DELETE" });
}
