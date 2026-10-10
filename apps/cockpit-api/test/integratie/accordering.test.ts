import { ConflictException } from "@nestjs/common";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";
import { mdtoKandidaat } from "./helpers/kandidaat.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;

const rm = gebruiker("rm1", "recordmanager");
const po = gebruiker("po1", "proceseigenaar");
const arch = gebruiker("arch1", "archivaris");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);
});

afterAll(async () => {
  await db?.stop();
});

// Taak in beoordeling met twee kandidaten.
async function maakTaak() {
  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "Accordering",
      status: "beoordeling",
      recordmanagerId: basis.rm.id,
      proceseigenaarId: basis.po.id,
      archivarisId: basis.arch.id,
    },
  });
  await client.selectie.create({
    data: {
      taakinstantieId: taak.id,
      stekkerId: basis.stekker.id,
      stekkerConfiguratieId: configuratie.id,
      externSelectieId: `sel-${taak.id}`,
      status: "GEIMPORTEERD",
      kandidaten: {
        create: [0, 1].map((i) => mdtoKandidaat(`vk-${i}`, { kenmerk: `bron-${i}`, naam: `Zaak ${i}` })),
      },
    },
  });
  const kandidaten = await client.vernietigingskandidaat.findMany({
    where: { selectie: { taakinstantieId: taak.id } },
    orderBy: { kandidaatId: "asc" },
  });
  return { taak, kandidaten };
}

const versie = async (id: string) => (await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id } })).versie;
const kandidaatInLijst = async (taakId: string, id: string) =>
  (await taken.beoordeling.getKandidaten(rm, taakId)).kandidaten.find((kandidaat) => kandidaat.id === id)!;

async function totVrijgegeven() {
  const { taak, kandidaten } = await maakTaak();
  for (const kandidaat of kandidaten) {
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, kandidaat.id, { beoordeling: "AKKOORD", toelichting: "RM: termijn verstreken" });
  }
  await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id));
  await taken.besluitvorming.proceseigenaarBesluiten(po, taak.id, await versie(taak.id));
  await taken.besluitvorming.archivarisBesluiten(arch, taak.id, await versie(taak.id));
  return { taak, kandidaten };
}

describe("besluiten van PO en archivaris per kandidaat (CC-9)", () => {
  it("overschrijven de toelichting van de recordmanager niet meer; de schermen tonen hetzelfde als voorheen", async () => {
    const { taak, kandidaten } = await maakTaak();
    const [k] = kandidaten;
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: termijn verstreken" });
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, kandidaten[1].id, { beoordeling: "AKKOORD" });
    await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id));

    const antwoord = await taken.besluitvorming.updateProceseigenaarAccordering(po, taak.id, k.id, { besluit: "AKKOORD", toelichting: "PO: akkoord" });
    expect(antwoord).toMatchObject({ beoordeling: "AKKOORD", toelichting: "PO: akkoord" });

    // In de database blijft de RM-toelichting staan; het besluit staat apart.
    expect(await db.prisma.client.vernietigingskandidaat.findUniqueOrThrow({ where: { id: k.id } })).toMatchObject({
      toelichting: "RM: termijn verstreken",
      beoordeeldDoor: basis.rm.id,
    });
    expect(await db.prisma.client.kandidaatBesluit.findMany({ where: { kandidaatId: k.id } })).toEqual([
      expect.objectContaining({ rol: "proceseigenaar", besluit: "AKKOORD", toelichting: "PO: akkoord", ronde: 1, medewerkerId: basis.po.id }),
    ]);

    // De kandidatenlijst toont, zoals voorheen, de toelichting van het laatste besluit.
    expect(await kandidaatInLijst(taak.id, k.id)).toMatchObject({
      toelichting: "PO: akkoord",
      toelichtingRecordmanager: "RM: termijn verstreken",
      laatsteBesluit: { rol: "proceseigenaar", besluit: "AKKOORD" },
    });
  });

  it("na terugsturen ziet de RM de reden; beoordeelt de RM opnieuw, dan telt diens toelichting weer", async () => {
    const { taak, kandidaten } = await maakTaak();
    const [k, ander] = kandidaten;
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: eerste" });
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, ander.id, { beoordeling: "AKKOORD", toelichting: "RM: blijft" });
    await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id));
    await taken.besluitvorming.updateProceseigenaarAccordering(po, taak.id, k.id, { besluit: "RETOUR", toelichting: "PO: bewaartermijn klopt niet" });
    await taken.besluitvorming.proceseigenaarBesluiten(po, taak.id, await versie(taak.id));

    expect(await kandidaatInLijst(taak.id, k.id)).toMatchObject({ beoordeling: "RETOUR", toelichting: "PO: bewaartermijn klopt niet" });
    // De andere beoordeling blijft staan.
    expect(await kandidaatInLijst(taak.id, ander.id)).toMatchObject({ beoordeling: "AKKOORD", toelichting: "RM: blijft" });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: aangepast" });
    expect(await kandidaatInLijst(taak.id, k.id)).toMatchObject({ beoordeling: "AKKOORD", toelichting: "RM: aangepast" });
  });

  it("kandidaat_besluit is append-only, ook voor de applicatierol", async () => {
    const { taak, kandidaten } = await maakTaak();
    for (const kandidaat of kandidaten) {
      await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, kandidaat.id, { beoordeling: "AKKOORD" });
    }
    await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id));
    await taken.besluitvorming.updateProceseigenaarAccordering(po, taak.id, kandidaten[0].id, { besluit: "AKKOORD" });

    await expect(db.prisma.client.kandidaatBesluit.updateMany({ data: { toelichting: "x" } })).rejects.toThrow(/append-only/);
    const app = new pg.Client({ connectionString: db.appUrl });
    await app.connect();
    try {
      await expect(app.query('DELETE FROM "kandidaat_besluit"')).rejects.toThrow(/permission denied/);
      await expect(app.query('SELECT count(*) FROM "kandidaat_besluit"')).resolves.toBeTruthy();
    } finally {
      await app.end();
    }
  });
});

describe("lijstcontrole bij de vernietigingsopdracht (CC-9)", () => {
  it("legt de vingerafdruk vast bij de vrijgave en laat een ongewijzigde lijst door", async () => {
    const { taak } = await totVrijgegeven();

    const na = await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taak.id } });
    expect(na.lijstHash).toMatch(/^[0-9a-f]{64}$/);

    await expect(taken.uitvoering.vernietigingsopdracht(rm, taak.id, na.versie)).resolves.toMatchObject({ status: "uitvoering" });
  });

  it("weigert de opdracht met 409 en een audit-event als de lijst na de vrijgave is gewijzigd", async () => {
    const { taak, kandidaten } = await totVrijgegeven();
    // Buiten de applicatie om gewijzigd (de API staat dit in deze status niet toe).
    await db.prisma.client.vernietigingskandidaat.update({ where: { id: kandidaten[0].id }, data: { beoordeling: "UITGESLOTEN" } });

    await expect(taken.uitvoering.vernietigingsopdracht(rm, taak.id, await versie(taak.id))).rejects.toThrow(ConflictException);

    expect((await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taak.id } })).status).toBe("vrijgegeven");
    expect(await db.prisma.client.vernietiging.count({ where: { taakinstantieId: taak.id } })).toBe(0);
    const event = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, eventType: "Uitvoering mislukt" } });
    expect(event.details).toMatchObject({ reden: "LIST_CHANGED" });
  });
});
