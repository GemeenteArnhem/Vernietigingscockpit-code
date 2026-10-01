import type { AppRole, SessionUser } from "../auth/authConfig";
import { getInitials } from "../auth/authConfig";
import { apiRequest } from "./apiClient";

type MeResponse = {
  id: string;
  username: string;
  name?: string;
  email?: string;
  roles: AppRole[];
  actions: string[];
  medewerkerId?: string | null;
};

export async function getMe(accessToken: string) {
  const me = await apiRequest<MeResponse>("/me", { accessToken });
  const name = me.name ?? me.username;

  return {
    id: me.id,
    name,
    email: me.email,
    roles: me.roles,
    initials: getInitials(name),
    medewerkerId: me.medewerkerId,
  } satisfies SessionUser;
}
