import { BadRequestException, PreconditionFailedException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService } from "../../src/modules/audit/audit.service.js";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import type { KandidatenQuery } from "../../src/modules/taken/kandidaten-lijst.js";
import { kandidatenQuerySchema } from "@vernietigingscockpit/api-contract";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;
let taakId: string;

const rm = gebruiker("rm1", "recordmanager");
const po = gebruiker("po1", "proceseigenaar");
const AANTAL = 1_200;

// Zoals de controller: query-parameters door het zod-schema.
const query = (parameters: Record<string, string> = {}): KandidatenQuery => kandidatenQuerySchema.parse(parameters);

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);

  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "Grote lijst",
      status: "beoordeling",
      recordmanagerId: basis.rm.id,
      proceseigenaarId: basis.po.id,
      archivarisId: basis.arch.id,
    },
  });
  taakId = taak.id;
  const selectie = await client.selectie.create({
    data: {
      taakinstantieId: taak.id,
      stekkerId: basis.stekker.id,
      stekkerConfiguratieId: configuratie.id,
      externSelectieId: "groot",
      status: "GEIMPORTEERD",
    },
  });
  await client.vernietigingskandidaat.createMany({
    data: Array.from({ length: AANTAL }, (_, i) => ({
      selectieId: selectie.id,
      kandidaatId: `vk-${String(i).padStart(5, "0")}`,
      bronId: `BRON-${i}`,
      omschrijving: i % 100 === 0 ? `Bijzondere zaak ${i}` : `Zaak ${i}`,
      classificatiesleutel: i % 2 === 0 ? "A.1" : "B.2",
      selectielijst: i % 3 === 0 ? "2017" : "2020",
      bewaartermijn: i % 2 === 0 ? "7 jaar" : "10 jaar",
      vernietigingsdatum: new Date(Date.UTC(2020, i % 12, 1)),
      aantalObjecten: i,
      bron: {},
    })),
  });
});

afterAll(async () => {
  await db?.stop();
});

describe("kandidatenlijst op de server (CC-10)", () => {
  it("pagineert zonder overlap, met volgnummers in de vaste volgorde en een response onder 1 MB", async () => {
    const paginas = await Promise.all(
      [0, 500, 1000].map((offset) => taken.beoordeling.getKandidaten(rm, taakId, query({ offset: String(offset), limit: "500" })))
    );

    expect(paginas.map((pagina) => pagina.kandidaten.length)).toEqual([500, 500, 200]);
    expect(paginas[0].pagina).toEqual({ offset: 0, limit: 500, totaal: AANTAL });
    const ids = paginas.flatMap((pagina) => pagina.kandidaten.map((kandidaat) => kandidaat.id));
    expect(new Set(ids).size).toBe(AANTAL);
    expect(paginas.flatMap((pagina) => pagina.kandidaten.map((kandidaat) => kandidaat.volgnummer))).toEqual(
      Array.from({ length: AANTAL }, (_, i) => i + 1)
    );
    expect(Buffer.byteLength(JSON.stringify(paginas[0]))).toBeLessThan(1_000_000);
  });

  it("geeft tellingen en filterkeuzes over de hele lijst", async () => {
    const pagina = await taken.beoordeling.getKandidaten(rm, taakId, query({ limit: "10" }));

    expect(pagina.tellingen).toMatchObject({ totaal: AANTAL, opgenomen: AANTAL });
    expect(pagina.facetten).toEqual({
      status: ["nog-te-beoordelen"],
      selectielijst: ["2017", "2020"],
      bewaartermijn: ["10 jaar", "7 jaar"],
      stekker: ["Teststekker"],
    });
  });

  it("filtert, zoekt en sorteert op de server", async () => {
    const opSelectielijst = await taken.beoordeling.getKandidaten(rm, taakId, query({ selectielijst: "2017", limit: "1" }));
    expect(opSelectielijst.pagina.totaal).toBe(400);

    const opTermijn = await taken.beoordeling.getKandidaten(rm, taakId, query({ bewaartermijn: "10 jaar", limit: "1" }));
    expect(opTermijn.pagina.totaal).toBe(600);

    const zoeken = await taken.beoordeling.getKandidaten(rm, taakId, query({ zoek: "bijzondere", zoekIn: "omschrijving" }));
    expect(zoeken.kandidaten).toHaveLength(12);

    const opMaand = await taken.beoordeling.getKandidaten(rm, taakId, query({ zoek: "2020-03", zoekIn: "vernietigingsdatum", limit: "1" }));
    expect(opMaand.pagina.totaal).toBe(100);

    const grootste = await taken.beoordeling.getKandidaten(rm, taakId, query({ sort: "aantalObjecten", richting: "desc", limit: "1" }));
    expect(grootste.kandidaten[0].aantalObjecten).toBe(AANTAL - 1);

    const ids = await taken.beoordeling.getKandidaatIds(rm, taakId, query({ selectielijst: "2017" }));
    expect(ids.ids).toHaveLength(400);
  });

  it("vat een selectie samen voor het detailpaneel", async () => {
    // Selectielijst 2017 (elke derde kandidaat): gedeelde selectielijst, gemengde codes.
    const { ids } = await taken.beoordeling.getKandidaatIds(rm, taakId, query({ selectielijst: "2017" }));

    const samenvatting = await taken.beoordeling.getKandidatenSamenvatting(rm, taakId, ids);

    expect(samenvatting).toMatchObject({
      aantal: 400,
      selectielijst: { waarde: "2017", verschillend: false },
      stekker: { waarde: "Teststekker", verschillend: false },
      code: { waarde: null, verschillend: true },
      vernietigingsdatum: { van: "2020-01-01T00:00:00.000Z", tot: "2020-10-01T00:00:00.000Z" },
      volgnummer: { van: 1, tot: expect.any(Number) },
    });
  });
});

describe("bulkbesluiten (CC-10)", () => {
  it("weigert id's die niet bij de taak horen en een verouderde versie, zonder iets te wijzigen", async () => {
    const versie = (await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taakId } })).versie;
    const { ids } = await taken.beoordeling.getKandidaatIds(rm, taakId, query({ limit: "2" }));

    await expect(
      taken.beoordeling.bulkBeoordeling(rm, taakId, versie, { ids: [ids[0], "00000000-0000-4000-8000-000000000001"], beoordeling: "AKKOORD" })
    ).rejects.toThrow(BadRequestException);
    await expect(taken.beoordeling.bulkBeoordeling(rm, taakId, versie - 1, { ids: [ids[0]], beoordeling: "AKKOORD" })).rejects.toThrow(
      PreconditionFailedException
    );
    expect((await taken.beoordeling.getKandidaten(rm, taakId, query({ limit: "1" }))).tellingen.opgenomen).toBe(AANTAL);
  });

  it("beoordeelt de hele lijst in één verzoek, met een audit-event per kandidaat en een intacte keten", async () => {
    const versie = (await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taakId } })).versie;
    const { ids } = await taken.beoordeling.getKandidaatIds(rm, taakId, query());

    const start = Date.now();
    await expect(taken.beoordeling.bulkBeoordeling(rm, taakId, versie, { ids, beoordeling: "AKKOORD", toelichting: "Bulk" })).resolves.toEqual({
      bijgewerkt: AANTAL,
    });
    expect(Date.now() - start).toBeLessThan(30_000);

    const pagina = await taken.beoordeling.getKandidaten(rm, taakId, query({ limit: "1" }));
    expect(pagina.tellingen).toMatchObject({ opgenomen: 0, akkoord: AANTAL });
    expect(await db.prisma.client.auditEvent.count({ where: { taakinstantieId: taakId, actie: "OBJECT_INCLUDED" } })).toBe(AANTAL);
    const verificatie = await new AuditService(db.prisma, new CurrentMedewerkerService(db.prisma)).verifieer(rm, taakId);
    expect(verificatie).toMatchObject({ intact: true, aantalEvents: AANTAL });
  });

  it("een bulkbesluit van de PO legt per kandidaat een besluit vast", async () => {
    await taken.beoordeling.beoordelingVoorleggen(rm, taakId, (await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taakId } })).versie);
    const versie = (await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taakId } })).versie;
    const { ids } = await taken.beoordeling.getKandidaatIds(po, taakId, query({ zoek: "bijzondere", zoekIn: "omschrijving" }));

    await taken.besluitvorming.bulkBesluit(po, taakId, versie, { ids, besluit: "RETOUR", toelichting: "Nakijken" }, "proceseigenaar");

    expect(await db.prisma.client.kandidaatBesluit.count({ where: { taakinstantieId: taakId, besluit: "RETOUR" } })).toBe(12);
    const pagina = await taken.beoordeling.getKandidaten(po, taakId, query({ status: "retour" }));
    expect(pagina.kandidaten).toHaveLength(12);
    expect(pagina.kandidaten[0]).toMatchObject({ toelichting: "Nakijken", toelichtingRecordmanager: "Bulk" });
  });
});
