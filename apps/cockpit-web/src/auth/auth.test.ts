import type { User } from "oidc-client-ts";
import { describe, expect, it } from "vitest";

import { begintBijTaken, getInitials, heeftDashboard } from "./authConfig";
import { formatRoles, sessionUserFromOidcUser } from "./sessionUser";

describe("startpagina per rol", () => {
  it("geeft rollen met een werkvoorraad een dashboard", () => {
    expect(heeftDashboard(["recordmanager"])).toBe(true);
    expect(heeftDashboard(["auditor"])).toBe(true);
    expect(heeftDashboard(["functioneel_beheerder"])).toBe(false);
  });

  it("laat alleen een gebruiker zonder dashboard die Taken mag zien bij Taken beginnen", () => {
    expect(begintBijTaken(["functioneel_beheerder"])).toBe(true);
    expect(begintBijTaken(["functioneel_beheerder", "recordmanager"])).toBe(false);
    // Zonder herkende rol naar het dashboard, anders kaatst RequireRole eindeloos terug.
    expect(begintBijTaken([])).toBe(false);
  });
});

describe("getInitials", () => {
  it("neemt de eerste letters van de eerste twee woorden", () => {
    expect(getInitials("rianne de recordmanager")).toBe("RD");
    expect(getInitials("Anna")).toBe("A");
    expect(getInitials("  ")).toBe("VC");
  });
});

describe("sessionUserFromOidcUser", () => {
  const gebruiker = (profile: Record<string, unknown>) => ({ profile }) as unknown as User;

  it("neemt alleen bekende app-rollen over uit realm_access", () => {
    const user = sessionUserFromOidcUser(
      gebruiker({ sub: "u1", name: "Anna Archivaris", email: "a@voorbeeld.test", realm_access: { roles: ["archivaris", "offline_access"] } })
    );

    expect(user).toEqual({ id: "u1", name: "Anna Archivaris", email: "a@voorbeeld.test", roles: ["archivaris"], initials: "AA" });
  });

  it("valt terug op gebruikersnaam, e-mail of een vaste naam", () => {
    expect(sessionUserFromOidcUser(gebruiker({ sub: "u2", preferred_username: "pieter" })).name).toBe("pieter");
    expect(sessionUserFromOidcUser(gebruiker({ sub: "u3", email: "x@voorbeeld.test" })).name).toBe("x@voorbeeld.test");
    expect(sessionUserFromOidcUser(gebruiker({ sub: "u4" }))).toMatchObject({ name: "Ingelogde gebruiker", roles: [] });
  });
});

describe("formatRoles", () => {
  it("toont rollen leesbaar, of 'Geen rol'", () => {
    expect(formatRoles([])).toBe("Geen rol");
    expect(formatRoles(["functioneel_beheerder", "auditor"])).toBe("functioneel beheerder, auditor");
  });
});
