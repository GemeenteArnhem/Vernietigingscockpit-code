import { render } from "@testing-library/react";

import App from "../App";
import type { AppRole, SessionUser } from "../auth/authConfig";
import { SessionUserContext } from "../auth/useSessionUser";

// Rendert de hele app (routes, AppShell, pagina) op `pad`, als ingelogde gebruiker met `rollen`.
// Inloggen staat in tests uit (authEnabled is false buiten een productiebuild); de gebruiker
// komt direct uit de SessionUserContext, net als na het ophalen van /me.
export function renderApp(pad: string, rollen: AppRole[] = ["recordmanager"]) {
  const user: SessionUser = {
    id: "gebruiker-1",
    name: "Rianne Recordmanager",
    email: "rm@voorbeeld.test",
    roles: rollen,
    initials: "RR",
    medewerkerId: "m-1",
  };

  window.history.pushState({}, "", pad);

  return render(
    <SessionUserContext.Provider value={{ user, accessToken: "test-token", signOut: () => undefined }}>
      <App />
    </SessionUserContext.Provider>
  );
}
