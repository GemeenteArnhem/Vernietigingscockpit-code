import type { AppRole } from "./app-role.js";

export type AuthUser = {
  sub: string;
  username?: string;
  name?: string;
  email?: string;
  // email_verified uit het token: alleen dan mag e-mail de eerste koppeling bepalen (CC-12).
  emailVerified?: boolean;
  roles: AppRole[];
  issuer: string;
  audience: string | string[];
};
