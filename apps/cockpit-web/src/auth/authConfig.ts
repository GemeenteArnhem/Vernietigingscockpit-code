import type { WebStorageStateStore } from "oidc-client-ts";

// Inloggen staat altijd aan in een productiebuild (CC-13). Alleen in ontwikkelmodus
// (vite dev) kan VITE_AUTH_ENABLED het uitzetten voor een ontwikkelgebruiker.
export const authEnabled = import.meta.env.DEV ? import.meta.env.VITE_AUTH_ENABLED === "true" : true;

export type AppRole =
  | "recordmanager"
  | "proceseigenaar"
  | "archivaris"
  | "functioneel_beheerder"
  | "auditor";

export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  roles: AppRole[];
  initials: string;
  medewerkerId?: string | null;
};

export const devSessionUser: SessionUser = {
  id: "dev-user",
  name: "Ontwikkelgebruiker",
  email: "dev@example.local",
  roles: ["recordmanager"],
  initials: "OG",
};

export function getOidcConfig(userStore?: WebStorageStateStore) {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;

  if (!authority || !clientId) {
    throw new Error(
      "OIDC is ingeschakeld, maar VITE_OIDC_AUTHORITY of VITE_OIDC_CLIENT_ID ontbreekt."
    );
  }

  return {
    authority,
    client_id: clientId,
    redirect_uri:
      import.meta.env.VITE_OIDC_REDIRECT_URI ??
      `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri:
      import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI ??
      window.location.origin,
    response_type: "code",
    scope: import.meta.env.VITE_OIDC_SCOPE ?? "openid profile email",
    automaticSilentRenew: true,
    loadUserInfo: true,
    userStore,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
}

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "VC";
}
