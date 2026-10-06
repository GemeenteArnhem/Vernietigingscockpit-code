import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { useAuth } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { authEnabled, devSessionUser, getOidcConfig } from "./authConfig";
import type { SessionUser } from "./authConfig";
import { getMe } from "../api/me";
import { registreerTokenVernieuwer } from "../api/apiClient";
import { sessionUserFromOidcUser } from "./sessionUser";
import { SessionUserContext } from "./useSessionUser";

type Props = {
  children: ReactNode;
};

export default function AuthProvider({ children }: Props) {
  if (!authEnabled) {
    return (
      <SessionUserContext.Provider value={{ user: devSessionUser }}>
        {children}
      </SessionUserContext.Provider>
    );
  }

  return (
    <OidcAuthProvider
      {...getOidcConfig(
        // sessionStorage (CC-13): blijft bij verversen, verdwijnt met het tabblad.
        new WebStorageStateStore({ store: window.sessionStorage })
      )}
    >
      <AuthenticatedSessionProvider>{children}</AuthenticatedSessionProvider>
    </OidcAuthProvider>
  );
}

function AuthenticatedSessionProvider({ children }: Props) {
  const auth = useAuth();
  const [apiUser, setApiUser] = useState<SessionUser | null>(null);
  const oidcUser = auth.user ? sessionUserFromOidcUser(auth.user) : devSessionUser;
  const accessToken = auth.user?.access_token;

  // Bij een 401 vernieuwt de API-client het token stil via Keycloak.
  useEffect(() => {
    registreerTokenVernieuwer(async () => (await auth.signinSilent())?.access_token);
    return () => registreerTokenVernieuwer(null);
  }, [auth]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isCurrent = true;

    getMe(accessToken)
      .then((user) => {
        if (isCurrent) {
          setApiUser(user);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setApiUser(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken]);

  return (
    <SessionUserContext.Provider
      value={{
        user: apiUser ?? oidcUser,
        accessToken,
        signOut: () => void auth.signoutRedirect(),
      }}
    >
      {children}
    </SessionUserContext.Provider>
  );
}
