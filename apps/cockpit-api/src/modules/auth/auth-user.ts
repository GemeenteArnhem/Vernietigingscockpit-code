import type { AppRole } from "./app-role.js";

export type AuthUser = {
  sub: string;
  username?: string;
  name?: string;
  email?: string;
  roles: AppRole[];
  issuer: string;
  audience: string | string[];
};
