import { ConflictException, NotFoundException } from "@nestjs/common";
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
      naam: "Opmerkingen",
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
const opmerkingen = async (user: typeof rm, taakId: string, id: string) =>
  (await taken.beoordeling.getKandidaten(user, taakId)).kandidaten.find((kandidaat) => kandidaat.id === id)!.opmerkingen;

describe("opmerkingen per kandidaat (besluit 2026-11-12)", () => {
  it("bewaren elke toelichting met naam, rol en ronde; niemand overschrijft een ander", async () => {
    const { taak, kandidaten } = await maakTaak();
    const [k, ander] = kandidaten;
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: eerste" });
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: tweede" });
    // Zonder toelichting geen opmerking.
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, ander.id, { beoordeling: "AKKOORD" });
    await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id));
    await taken.besluitvorming.updateProceseigenaarAccordering(po, taak.id, k.id, { besluit: "RETOUR", toelichting: "PO: klopt niet" });
    await taken.besluitvorming.proceseigenaarBesluiten(po, taak.id, await versie(taak.id));

    expect(await opmerkingen(rm, taak.id, k.id)).toEqual([
      expect.objectContaining({ rol: "recordmanager", medewerker: { id: basis.rm.id, naam: "Rita Recordmanager" }, tekst: "RM: eerste", ronde: 1, verwijderbaar: false }),
      expect.objectContaining({ rol: "recordmanager", tekst: "RM: tweede", ronde: 1, verwijderbaar: false }),
      expect.objectContaining({ rol: "proceseigenaar", medewerker: { id: basis.po.id, naam: "Peter Proceseigenaar" }, tekst: "PO: klopt niet", ronde: 1 }),
    ]);
    expect(await opmerkingen(rm, taak.id, ander.id)).toEqual([]);

    // Ronde 2: de RM beoordeelt opnieuw; alleen die nieuwe opmerking is verwijderbaar.
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: aangepast" });
    const lijst = await opmerkingen(rm, taak.id, k.id);
    expect(lijst.map((opmerking) => [opmerking.tekst, opmerking.ronde, opmerking.verwijderbaar])).toEqual([
      ["RM: eerste", 1, false],
      ["RM: tweede", 1, false],
      ["PO: klopt niet", 1, false],
      ["RM: aangepast", 2, true],
    ]);
    // Voor de proceseigenaar is de opmerking van de RM niet verwijderbaar.
    expect((await opmerkingen(po, taak.id, k.id)).every((opmerking) => !opmerking.verwijderbaar)).toBe(true);
  });

  it("de auteur verwijdert een eigen opmerking in de eigen stap; die verdwijnt voor iedereen, het auditlog legt het vast", async () => {
    const { taak, kandidaten } = await maakTaak();
    const [k, ander] = kandidaten;
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "AKKOORD", toelichting: "RM: weg ermee" });
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, ander.id, { beoordeling: "AKKOORD" });
    const [opmerking] = await opmerkingen(rm, taak.id, k.id);
    expect(opmerking.verwijderbaar).toBe(true);

    await taken.opmerking.verwijder(rm, taak.id, k.id, opmerking.id);

    expect(await opmerkingen(rm, taak.id, k.id)).toEqual([]);
    expect(await db.prisma.client.kandidaatOpmerking.findUniqueOrThrow({ where: { id: opmerking.id } })).toMatchObject({
      tekst: "RM: weg ermee",
      verwijderdDoor: basis.rm.id,
      verwijderdOp: expect.any(Date),
    });
    expect(await db.prisma.client.auditEvent.findFirst({ where: { taakinstantieId: taak.id, eventType: "Opmerking verwijderd" } })).toMatchObject({
      eventTypeBegrippenlijst: "Cockpit-eventtypen 1.0",
      entiteitId: k.id,
      details: { opmerkingId: opmerking.id, rol: "recordmanager", ronde: 1 },
    });
    // Twee keer verwijderen kan niet.
    await expect(taken.opmerking.verwijder(rm, taak.id, k.id, opmerking.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("weigert de opmerking van een ander (404), na doorzetten (409) en de toelichting bij de huidige uitsluiting (409)", async () => {
    const { taak, kandidaten } = await maakTaak();
    const [k, ander] = kandidaten;
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, k.id, { beoordeling: "UITGESLOTEN", uitsluitReden: "Lopend verzoek of procedure", toelichting: "RM: Woo-verzoek" });
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, ander.id, { beoordeling: "AKKOORD", toelichting: "RM: akkoord" });

    const [uitsluiting] = await opmerkingen(rm, taak.id, k.id);
    expect(uitsluiting.verwijderbaar).toBe(false);
    await expect(taken.opmerking.verwijder(rm, taak.id, k.id, uitsluiting.id)).rejects.toBeInstanceOf(ConflictException);

    await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id));
    const [rmOpmerking] = await opmerkingen(rm, taak.id, ander.id);
    expect(rmOpmerking.verwijderbaar).toBe(false);
    await expect(taken.opmerking.verwijder(rm, taak.id, ander.id, rmOpmerking.id)).rejects.toBeInstanceOf(ConflictException);
    // De proceseigenaar kan de opmerking van de RM niet verwijderen: niet gevonden.
    await expect(taken.opmerking.verwijder(po, taak.id, ander.id, rmOpmerking.id)).rejects.toBeInstanceOf(NotFoundException);

    // De proceseigenaar wel de eigen opmerking, zolang de taak bij hem ligt.
    await taken.besluitvorming.updateProceseigenaarAccordering(po, taak.id, ander.id, { besluit: "AKKOORD", toelichting: "PO: prima" });
    const poOpmerking = (await opmerkingen(po, taak.id, ander.id)).find((opmerking) => opmerking.rol === "proceseigenaar")!;
    expect(poOpmerking.verwijderbaar).toBe(true);
    await taken.besluitvorming.proceseigenaarBesluiten(po, taak.id, await versie(taak.id));
    await expect(taken.opmerking.verwijder(po, taak.id, ander.id, poOpmerking.id)).rejects.toBeInstanceOf(ConflictException);

    // De archivaris ziet alle opmerkingen; na vrijgave liggen ze vast.
    expect((await opmerkingen(arch, taak.id, ander.id)).map((opmerking) => opmerking.tekst)).toEqual(["RM: akkoord", "PO: prima"]);
  });

  it("de resultaatpagina toont de opmerkingen, alleen lezen", async () => {
    const { taak, kandidaten } = await maakTaak();
    for (const kandidaat of kandidaten) {
      await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, kandidaat.id, { beoordeling: "AKKOORD", toelichting: "RM: termijn verstreken" });
    }
    await db.prisma.client.taakinstantie.update({ where: { id: taak.id }, data: { status: "resultaat" } });

    const { resultaten } = await taken.uitvoering.getVernietigingsresultaten(rm, taak.id);
    expect(resultaten[0].opmerkingen).toEqual([
      expect.objectContaining({ rol: "recordmanager", tekst: "RM: termijn verstreken", verwijderbaar: false }),
    ]);
  });

  it("de database staat alleen één keer logisch verwijderen toe, en geen DELETE door de applicatierol", async () => {
    const { taak, kandidaten } = await maakTaak();
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, kandidaten[0].id, { beoordeling: "AKKOORD", toelichting: "RM: vast" });
    const client = db.prisma.client;

    await expect(client.kandidaatOpmerking.updateMany({ where: { taakinstantieId: taak.id }, data: { tekst: "gewijzigd" } })).rejects.toThrow(/logisch/);
    await client.kandidaatOpmerking.updateMany({ where: { taakinstantieId: taak.id }, data: { verwijderdOp: new Date(), verwijderdDoor: basis.rm.id } });
    await expect(client.kandidaatOpmerking.updateMany({ where: { taakinstantieId: taak.id }, data: { verwijderdOp: new Date() } })).rejects.toThrow(/logisch/);

    const app = new pg.Client({ connectionString: db.appUrl });
    await app.connect();
    try {
      await expect(app.query('DELETE FROM "kandidaat_opmerking"')).rejects.toThrow(/permission denied/);
    } finally {
      await app.end();
    }
  });
});
