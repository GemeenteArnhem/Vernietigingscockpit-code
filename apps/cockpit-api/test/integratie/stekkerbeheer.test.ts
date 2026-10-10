import { randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { stekkerSchema, type StekkerInvoer } from "@vernietigingscockpit/api-contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StekkerbeheerService } from "../../src/modules/stekkers/stekkerbeheer.service.js";
import { ontsleutel } from "../../src/shared/geheim/geheim.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";

// Stekkerbeheer door de functioneel beheerder: configuratieversies, versleuteld secret,
// (de)activeren, verwijderen alleen als ongebruikt, en alles in het configuratielog.

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let beheer: StekkerbeheerService;
const sleutel = randomBytes(32);
const fb = gebruiker("fb1", "functioneel_beheerder");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  beheer = new StekkerbeheerService(db.prisma, new ConfigService({ SECRET_ENCRYPTION_KEY: sleutel.toString("base64") }));
});

afterAll(async () => {
  await db?.stop();
});

const invoer = (overrides: Partial<StekkerInvoer> = {}) =>
  stekkerSchema.parse({
    naam: `Stekker ${randomBytes(3).toString("hex")}`,
    omschrijving: "Zaaksysteem",
    baseUrl: "https://stekker.example.test",
    authType: "oauth2_cc",
    tokenUrl: "https://auth.example.test/token",
    clientId: "cockpit-stekker",
    secret: "heel-geheim-1",
    scopes: ["selectie.read", "selectie.write"],
    timeouts: { requestMs: 30_000 },
    parameters: { batchGrootte: 100 },
    ...overrides,
  });

const configuraties = (stekkerId: string) =>
  db.prisma.client.stekkerConfiguratie.findMany({ where: { stekkerId }, orderBy: { versie: "asc" } });
const events = (entiteitId: string) =>
  db.prisma.client.configuratieEvent.findMany({ where: { entiteitId }, orderBy: { id: "asc" } });

describe("stekker aanmaken en bewerken", () => {
  it("maakt versie 1 met een versleuteld secret; de API en het log bevatten het secret nooit", async () => {
    const stekker = await beheer.aanmaken(fb, invoer());

    expect(stekker).toMatchObject({ actief: true, configuratie: { versie: 1, secretIngesteld: true, authType: "oauth2_cc" } });
    expect(JSON.stringify(stekker)).not.toContain("heel-geheim-1");

    const [configuratie] = await configuraties(stekker.id);
    expect(configuratie.secretVersleuteld).not.toContain("heel-geheim-1");
    expect(ontsleutel(configuratie.secretVersleuteld!, sleutel)).toBe("heel-geheim-1");

    const [event] = await events(stekker.id);
    expect(event).toMatchObject({ eventType: "Stekker aangemaakt", actorType: "user" });
    expect(JSON.stringify(event.details)).not.toContain("heel-geheim-1");
  });

  it("bewerken maakt een nieuwe versie; zonder nieuw secret blijft het oude; een verouderde versie geeft 412", async () => {
    const stekker = await beheer.aanmaken(fb, invoer());
    const gewijzigd = await beheer.bewerken(fb, stekker.id, 1, invoer({ naam: "Nieuwe naam", secret: null, baseUrl: "https://nieuw.example.test" }));

    expect(gewijzigd).toMatchObject({ naam: "Nieuwe naam", configuratie: { versie: 2, baseUrl: "https://nieuw.example.test", secretIngesteld: true } });
    expect(gewijzigd.versies.map((versie) => versie.versie)).toEqual([2, 1]);
    const [v1, v2] = await configuraties(stekker.id);
    expect(v1.baseUrl).toBe("https://stekker.example.test"); // oude versie ongewijzigd
    expect(ontsleutel(v2.secretVersleuteld!, sleutel)).toBe("heel-geheim-1");

    await expect(beheer.bewerken(fb, stekker.id, 1, invoer())).rejects.toMatchObject({ status: 412 });
    expect((await events(stekker.id)).map((event) => event.eventType)).toEqual(["Stekker aangemaakt", "Stekker gewijzigd"]);
  });

  it("een nieuw secret vervangt het oude; naar 'geen authenticatie' wist het", async () => {
    const stekker = await beheer.aanmaken(fb, invoer());
    await beheer.bewerken(fb, stekker.id, 1, invoer({ secret: "nieuw-geheim" }));
    const [, v2] = await configuraties(stekker.id);
    expect(ontsleutel(v2.secretVersleuteld!, sleutel)).toBe("nieuw-geheim");

    const zonder = await beheer.bewerken(fb, stekker.id, 2, invoer({ authType: "none", tokenUrl: null, clientId: null, secret: null }));
    expect(zonder.configuratie).toMatchObject({ versie: 3, authType: "none", secretIngesteld: false, tokenUrl: null });
  });

  it("zonder sleutel op de server kan geen secret worden opgeslagen (503)", async () => {
    const zonderSleutel = new StekkerbeheerService(db.prisma, new ConfigService({}));
    await expect(zonderSleutel.aanmaken(fb, invoer())).rejects.toMatchObject({ status: 503 });
  });

  it("weigert 'geen authenticatie' in productie", async () => {
    const productie = new StekkerbeheerService(db.prisma, new ConfigService({ NODE_ENV: "production" }));
    await expect(productie.aanmaken(fb, invoer({ authType: "none", tokenUrl: null, clientId: null, secret: null }))).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("deactiveren en verwijderen", () => {
  it("deactiveren en weer activeren, met configuratielog", async () => {
    const stekker = await beheer.aanmaken(fb, invoer());

    expect(await beheer.zetActief(fb, stekker.id, false)).toMatchObject({ actief: false, toegestaneActies: expect.arrayContaining(["stekker.activeren"]) });
    await expect(beheer.zetActief(fb, stekker.id, false)).rejects.toMatchObject({ status: 409 });
    expect(await beheer.zetActief(fb, stekker.id, true)).toMatchObject({ actief: true });
    expect((await events(stekker.id)).map((event) => event.eventType)).toEqual([
      "Stekker aangemaakt",
      "Stekker gedeactiveerd",
      "Stekker geactiveerd",
    ]);
  });

  it("een ongebruikte stekker kan echt weg; een gebruikte niet (409)", async () => {
    const ongebruikt = await beheer.aanmaken(fb, invoer());
    expect(ongebruikt.toegestaneActies).toContain("stekker.verwijderen");
    await beheer.verwijderen(fb, ongebruikt.id);
    expect(await db.prisma.client.stekker.count({ where: { id: ongebruikt.id } })).toBe(0);
    expect((await events(ongebruikt.id)).at(-1)).toMatchObject({ eventType: "Stekker verwijderd" });

    // De teststekker uit de basisdata hangt aan een taakdefinitie.
    const gebruikt = await beheer.detail(basis.stekker.id);
    expect(gebruikt.gebruik.taakdefinities).toBeGreaterThan(0);
    expect(gebruikt.toegestaneActies).not.toContain("stekker.verwijderen");
    await expect(beheer.verwijderen(fb, basis.stekker.id)).rejects.toMatchObject({ status: 409 });
  });

  it("de lijst toont ook inactieve stekkers", async () => {
    const stekker = await beheer.aanmaken(fb, invoer());
    await beheer.zetActief(fb, stekker.id, false);
    expect((await beheer.lijst()).find((item) => item.id === stekker.id)).toMatchObject({ actief: false });
  });
});
