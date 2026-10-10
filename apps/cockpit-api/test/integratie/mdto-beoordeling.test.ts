import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kandidaatBeoordelingSchema } from "@vernietigingscockpit/api-contract";
import { CurrentMedewerkerService } from "../../src/modules/auth/current-medewerker.service.js";
import { StamgegevensService } from "../../src/modules/stamgegevens/stamgegevens.service.js";
import type { StekkerClient, StekkerKandidaat } from "../../src/modules/stekker/stekker-client.js";
import type { Waardering } from "@vernietigingscockpit/stekker-client";
import { TaakdefinitiesService } from "../../src/modules/taakdefinities/taakdefinities.service.js";
import { SelectieWorkerService } from "../../src/modules/worker/selectie-worker.service.js";
import { WorkflowService } from "../../src/modules/workflow/workflow.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { stekkerKandidaat } from "./helpers/kandidaat.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

// ADR-0005 stap 2: automatische uitsluiting bij waardering B/N (B-M1), uitsluitredenen uit de
// begrippenlijst, en de archiefvormer op het profiel van de proceseigenaar (B-M3).

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;
let definities: TaakdefinitiesService;
let stamgegevens: StamgegevensService;
const rm = gebruiker("rm1", "recordmanager");
const fb = gebruiker("fb1", "functioneel_beheerder");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);
  definities = new TaakdefinitiesService(db.prisma, new CurrentMedewerkerService(db.prisma));
  stamgegevens = new StamgegevensService(db.prisma);
});

afterAll(async () => {
  await db?.stop();
});

// Taak in init met één READY-selectie; de nep-stekker levert de opgegeven kandidaten.
async function importeer(kandidaten: StekkerKandidaat[]) {
  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: "MDTO",
      status: "init",
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
      status: "READY",
      externSelectieId: "extern",
      selectietijdstip: new Date(),
    },
  });
  const stekker = {
    getSelectie: async () => ({ selectieId: "extern", status: "READY", totaalKandidaten: kandidaten.length }),
    getKandidaten: async () => ({ selectieId: "extern", items: kandidaten, totaal: kandidaten.length }),
  } as unknown as StekkerClient;
  const config = new ConfigService({ WORKER_MAX_POGINGEN: "3", WORKER_BACKOFF_START_MS: "1", WORKER_BACKOFF_MAX_MS: "5" });
  await new SelectieWorkerService(db.prisma, config, stekker, new WorkflowService()).verwerkRonde();

  return taak;
}

const metWaardering = (id: string, code: Waardering["begripCode"], label: Waardering["begripLabel"]): StekkerKandidaat => ({
  ...stekkerKandidaat(id, `bron-${id}`, `Zaak ${id}`),
  waardering: { begripLabel: label, begripCode: code, begripBegrippenlijst: { verwijzingNaam: "Begrippenlijst Waarderingen MDTO" } },
});

const kandidaatMet = (taakId: string, kandidaatId: string) =>
  db.prisma.client.vernietigingskandidaat.findFirstOrThrow({ where: { kandidaatId, selectie: { taakinstantieId: taakId } } });
const versie = async (taakId: string) => (await db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id: taakId } })).versie;

describe("automatische uitsluiting bij waardering B of N (B-M1)", () => {
  it("sluit B en N bij import uit met een vaste reden, toelichting en audit-event van het systeem", async () => {
    const taak = await importeer([
      metWaardering("v-1", "V", "Tijdelijk te bewaren"),
      metWaardering("b-1", "B", "Blijvend te bewaren"),
      metWaardering("n-1", "N", "Nader te bepalen"),
    ]);

    expect(await kandidaatMet(taak.id, "v-1")).toMatchObject({ beoordeling: "OPGENOMEN", uitsluitReden: null });
    for (const id of ["b-1", "n-1"]) {
      const kandidaat = await kandidaatMet(taak.id, id);
      expect(kandidaat).toMatchObject({ beoordeling: "UITGESLOTEN", uitsluitReden: "Waardering niet V" });
      expect(kandidaat.toelichting).toMatch(/alleen V \(Tijdelijk te bewaren\)/);
      const event = await db.prisma.client.auditEvent.findFirstOrThrow({
        where: { taakinstantieId: taak.id, entiteitId: kandidaat.id, eventType: "Kandidaat uitgesloten" },
      });
      expect(event).toMatchObject({ actorType: "system" });
      expect(event.details).toMatchObject({ automatisch: true, uitsluitReden: "Waardering niet V" });
    }
  });

  it("de recordmanager kan een automatisch uitgesloten kandidaat niet wijzigen, ook niet in bulk (409)", async () => {
    const taak = await importeer([metWaardering("v-2", "V", "Tijdelijk te bewaren"), metWaardering("b-2", "B", "Blijvend te bewaren")]);
    const vast = await kandidaatMet(taak.id, "b-2");
    const open = await kandidaatMet(taak.id, "v-2");

    await expect(
      taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, vast.id, { beoordeling: "AKKOORD", toelichting: null })
    ).rejects.toThrow(ConflictException);
    await expect(
      taken.beoordeling.bulkBeoordeling(rm, taak.id, await versie(taak.id), { ids: [open.id, vast.id], beoordeling: "AKKOORD", toelichting: null })
    ).rejects.toThrow(ConflictException);

    // De gewone kandidaat beoordelen; daarna kan de lijst worden voorgelegd.
    await taken.beoordeling.updateKandidaatBeoordeling(rm, taak.id, open.id, { beoordeling: "AKKOORD", toelichting: null });
    await expect(taken.beoordeling.beoordelingVoorleggen(rm, taak.id, await versie(taak.id))).resolves.toMatchObject({
      status: "accordering_po",
    });
  });
});

describe("uitsluitredenen uit de begrippenlijst", () => {
  it("vraagt bij uitsluiten een reden uit de lijst en een toelichting", () => {
    const geldig = { beoordeling: "UITGESLOTEN", uitsluitReden: "Lopend verzoek of procedure", toelichting: "Woo-verzoek loopt" };

    expect(kandidaatBeoordelingSchema.safeParse(geldig).success).toBe(true);
    expect(kandidaatBeoordelingSchema.safeParse({ ...geldig, uitsluitReden: "Zomaar" }).success).toBe(false);
    expect(kandidaatBeoordelingSchema.safeParse({ ...geldig, uitsluitReden: "Waardering niet V" }).success).toBe(false);
    expect(kandidaatBeoordelingSchema.safeParse({ ...geldig, uitsluitReden: null }).success).toBe(false);
    expect(kandidaatBeoordelingSchema.safeParse({ ...geldig, toelichting: " " }).success).toBe(false);
    expect(kandidaatBeoordelingSchema.safeParse({ beoordeling: "AKKOORD" }).success).toBe(true);
  });
});

describe("archiefvormer op het profiel van de proceseigenaar (B-M3)", () => {
  const definitie = (proceseigenaarId: string) => ({
    naam: `Archiefvormer ${Math.random().toString(36).slice(2, 7)}`,
    categorie: "Test",
    frequentie: "ad_hoc" as const,
    startmaand: null,
    recordmanagerId: basis.rm.id,
    proceseigenaarId,
    archivarisId: basis.arch.id,
    stekkers: [{ stekkerId: basis.stekker.id, selectieparameters: {} }],
  });

  it("weigert een taakdefinitie met een proceseigenaar zonder archiefvormer", async () => {
    const zonder = await db.prisma.client.medewerker.create({
      data: { naam: "Paula Zonder", email: "po-zonder@example.test", rollen: ["proceseigenaar"], bron: "test", externId: "po-zonder" },
    });

    await expect(definities.createTaakdefinitie(rm, definitie(zonder.id))).rejects.toThrow(BadRequestException);
  });

  it("pint de archiefvormer vast op de taakuitvoering; een latere profielwijziging werkt alleen door in nieuwe", async () => {
    const aangemaakt = await definities.createTaakdefinitie(rm, definitie(basis.po.id));
    const eerste = await definities.createTaakinstantie(rm, aangemaakt.id, {});

    await stamgegevens.importStamgegevens(fb, {
      medewerkers: [{ naam: "Peter Proceseigenaar", email: "po1@example.test", rollen: ["proceseigenaar"], archiefvormer: { verwijzingNaam: "Gemeente Nieuw" } }],
    });
    const tweede = await definities.createTaakinstantie(rm, aangemaakt.id, {});

    const lees = (id: string) => db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id } });
    expect((await lees(eerste.id)).archiefvormer).toEqual({ verwijzingNaam: "Gemeente Test" });
    expect((await lees(tweede.id)).archiefvormer).toEqual({ verwijzingNaam: "Gemeente Nieuw" });
  });

  it("de stamgegevens-import zet de archiefvormer, maar kan hem niet wissen bij een proceseigenaar in gebruik", async () => {
    await stamgegevens.importStamgegevens(fb, {
      medewerkers: [{
        naam: "Pim Proces",
        email: "po-nieuw@example.test",
        rollen: ["proceseigenaar"],
        archiefvormer: { verwijzingNaam: "Gemeente X", verwijzingIdentificatie: { identificatieKenmerk: "00000001234567890000", identificatieBron: "OIN" } },
      }],
    });
    const pim = await db.prisma.client.medewerker.findUniqueOrThrow({ where: { email: "po-nieuw@example.test" } });
    expect(pim.archiefvormer).toMatchObject({ verwijzingNaam: "Gemeente X", verwijzingIdentificatie: { identificatieBron: "OIN" } });

    // Weglaten laat de waarde staan.
    await stamgegevens.importStamgegevens(fb, { medewerkers: [{ naam: "Pim Proces", email: "po-nieuw@example.test", rollen: ["proceseigenaar"] }] });
    expect((await db.prisma.client.medewerker.findUniqueOrThrow({ where: { id: pim.id } })).archiefvormer).toMatchObject({ verwijzingNaam: "Gemeente X" });

    // Wissen mag niet zolang hij proceseigenaar is van een actieve taakdefinitie.
    await expect(
      stamgegevens.importStamgegevens(fb, {
        medewerkers: [{ naam: "Peter Proceseigenaar", email: "po1@example.test", rollen: ["proceseigenaar"], archiefvormer: null }],
      })
    ).rejects.toThrow(/archiefvormer kan niet worden gewist/);
  });
});
