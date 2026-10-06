import { SetMetadata } from "@nestjs/common";
import type { AppRole } from "./app-role.js";

export const ROLES_KEY = "roles";
export const ANY_AUTHENTICATED_KEY = "anyAuthenticated";

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

// Toegankelijk voor elke ingelogde gebruiker, ongeacht rol. De RolesGuard weigert
// standaard (default-deny): een endpoint zonder @Roles, @AnyAuthenticated of @Public
// is voor niemand bereikbaar.
export const AnyAuthenticated = () => SetMetadata(ANY_AUTHENTICATED_KEY, true);
