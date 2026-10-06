import type { SessionUser } from "../auth/authConfig";
import { getInitials } from "../auth/authConfig";
import type { ApiMe } from "@vernietigingscockpit/api-contract";
import { apiRequest } from "./apiClient";

export async function getMe(accessToken: string) {
  const me = await apiRequest<ApiMe>("/me", { accessToken });
  // Naam en gebruikersnaam zijn optioneel in het token; dan de id als laatste terugval.
  const name = me.name ?? me.username ?? me.id;

  return {
    id: me.id,
    name,
    email: me.email ?? undefined,
    roles: me.roles,
    initials: getInitials(name),
    medewerkerId: me.medewerkerId,
  } satisfies SessionUser;
}
