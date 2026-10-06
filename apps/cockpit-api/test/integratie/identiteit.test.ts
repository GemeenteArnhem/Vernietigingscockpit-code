import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthUser } from "../../src/modules/auth/auth-user.js";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";

let db: TestDatabase;
let service: CurrentMedewerkerService;
let teller = 0;

beforeAll(async () => {
  db = await startDatabase();
  service = new CurrentMedewerkerService(db.prisma);
});

afterAll(async () => {
  await db?.stop();
});

async function medewerker(overrides: { externId?: string | null; actief?: boolean } = {}) {
  teller += 1;
  return db.prisma.client.medewerker.create({
    data: {
      naam: `Medewerker ${teller}`,
      email: `mw${teller}@example.test`,
      rollen: ["recordmanager"],
      bron: "test",
      externId: overrides.externId === undefined ? `mw${teller}` : overrides.externId,
      actief: overrides.actief ?? true,
    },
  });
}

function gebruiker(sub: string, velden: Partial<AuthUser> = {}): AuthUser {
  return { sub, roles: ["recordmanager"], issuer: "https://idp.test", audience: "cockpit-api", ...velden };
}

const koppelEvents = (sub: string) =>
  db.prisma.client.configuratieEvent.findMany({ where: { actie: "USER_LINKED", entiteitId: sub } });

describe("identiteit op sub (CC-12)", () => {
  it("koppelt bij de eerste login op gebruikersnaam, met een USER_LINKED-event", async () => {
    const mw = await medewerker();

    expect(await service.findForUser(gebruiker("sub-1", { username: mw.externId! }))).toBe(mw.id);

    expect(await db.prisma.client.gebruiker.findUnique({ where: { id: "sub-1" } })).toMatchObject({ medewerkerId: mw.id });
    const [event] = await koppelEvents("sub-1");
    expect(event).toMatchObject({ actorType: "user", actorId: "sub-1", rol: "recordmanager" });
    expect(event.details).toMatchObject({ medewerkerId: mw.id, gekoppeldOp: "gebruikersnaam" });
  });

  it("zoekt daarna alleen op sub: een andere gebruikersnaam of e-mail verandert niets", async () => {
    const mw = await medewerker();
    const ander = await medewerker();
    await service.findForUser(gebruiker("sub-2", { username: mw.externId! }));

    expect(await service.findForUser(gebruiker("sub-2", { username: ander.externId!, email: ander.email, emailVerified: true }))).toBe(mw.id);
    expect(await koppelEvents("sub-2")).toHaveLength(1);
  });

  it("koppelt op e-mail alleen als de IdP het adres als geverifieerd meldt", async () => {
    const mw = await medewerker({ externId: null });

    expect(await service.findForUser(gebruiker("sub-3", { email: mw.email }))).toBeNull();
    expect(await service.findForUser(gebruiker("sub-3", { email: mw.email, emailVerified: false }))).toBeNull();
    expect(await service.findForUser(gebruiker("sub-3", { email: mw.email, emailVerified: true }))).toBe(mw.id);
    expect((await koppelEvents("sub-3"))[0].details).toMatchObject({ gekoppeldOp: "e-mail (geverifieerd)" });
  });

  it("koppelt een medewerker nooit aan een tweede gebruiker", async () => {
    const mw = await medewerker();
    await service.findForUser(gebruiker("sub-4a", { username: mw.externId! }));

    expect(await service.findForUser(gebruiker("sub-4b", { username: mw.externId! }))).toBeNull();
    expect(await koppelEvents("sub-4b")).toHaveLength(0);
  });

  it("geeft geen medewerker voor een inactieve medewerker, ook niet na koppeling", async () => {
    const inactief = await medewerker({ actief: false });
    expect(await service.findForUser(gebruiker("sub-5", { username: inactief.externId! }))).toBeNull();

    const mw = await medewerker();
    await service.findForUser(gebruiker("sub-6", { username: mw.externId! }));
    await db.prisma.client.medewerker.update({ where: { id: mw.id }, data: { actief: false } });
    expect(await service.findForUser(gebruiker("sub-6", { username: mw.externId! }))).toBeNull();
  });

  it("koppelt zonder rol niet", async () => {
    const mw = await medewerker();
    expect(await service.findForUser(gebruiker("sub-7", { username: mw.externId!, roles: [] }))).toBeNull();
  });

  it("gelijktijdige eerste verzoeken geven één koppeling en één event", async () => {
    const mw = await medewerker();

    const uitkomsten = await Promise.all(
      Array.from({ length: 5 }, () => service.findForUser(gebruiker("sub-8", { username: mw.externId! })))
    );

    expect(new Set(uitkomsten)).toEqual(new Set([mw.id]));
    expect(await koppelEvents("sub-8")).toHaveLength(1);
  });
});
