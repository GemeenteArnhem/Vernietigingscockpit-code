import type { User } from "oidc-client-ts";
import type { AppRole, SessionUser } from "./authConfig";
import { getInitials } from "./authConfig";

type RealmAccess = {
  roles?: string[];
};

const APP_ROLES: AppRole[] = [
  "recordmanager",
  "proceseigenaar",
  "archivaris",
  "functioneel_beheerder",
  "auditor",
];

export function sessionUserFromOidcUser(user: User): SessionUser {
  const profile = user.profile;
  const realmAccess = profile.realm_access as RealmAccess | undefined;
  const roles = (realmAccess?.roles ?? []).filter((role): role is AppRole =>
    APP_ROLES.includes(role as AppRole)
  );
  const name =
    profile.name ??
    profile.preferred_username ??
    profile.email ??
    "Ingelogde gebruiker";

  return {
    id: profile.sub,
    name,
    email: profile.email,
    roles,
    initials: getInitials(name),
  };
}

export function formatRoles(roles: AppRole[]) {
  if (roles.length === 0) {
    return "Geen rol";
  }

  return roles
    .map((role) => role.replace("_", " "))
    .join(", ");
}
