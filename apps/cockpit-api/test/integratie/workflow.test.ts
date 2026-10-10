import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WorkflowService } from "../../src/modules/workflow/workflow.service.js";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";
import { mdtoKandidaat } from "./helpers/kandidaat.js";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;
const workflow = new WorkflowService();

const rm = gebruiker("rm1", "recordmanager");
const po = gebruiker("po1", "proceseigenaar");
const arch = gebruiker("arch1", "archivaris");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db, workflow);
});

afterAll(async () => {
  await db?.stop();
});

// Taak in de gegeven status, met kandidaten in de gegeven beoordelingen.
async function maakTaak(status: string, beoordelingen: string[] = ["AKKOORD"]) {
  const client = db.prisma.client;
  const configuratie = await client.stekkerConfiguratie.findFirstOrThrow({ where: { stekkerId: basis.stekker.id } });
  const taak = await client.taakinstantie.create({
    data: {
      taakdefinitieId: basis.taakdefinitie.id,
      naam: `Workflow ${status}`,
      status: status as never,
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
        create: beoordelingen.map((beoordeling, i) => ({
          ...mdtoKandidaat(`vk-${i}`, { kenmerk: `bron-${i}`, naam: `Zaak ${i}` }),
          beoordeling,
        })),
      },
    },
  });
  return taak;
}

const lees = (id: string) => db.prisma.client.taakinstantie.findUniqueOrThrow({ where: { id } });
const auditActies = async (id: string) =>
  (await db.prisma.client.auditEvent.findMany({ where: { taakinstantieId: id }, orderBy: { id: "asc" } })).map(
    (event) => event.eventType
  );

describe("WorkflowService.transition", () => {
  it("wijzigt status, verhoogt de versie en schrijft het audit-event in dezelfde transactie", async () => {
    const taak = await maakTaak("beoordeling");

    const na = await db.prisma.client.$transaction((tx) =>
      workflow.transition(tx, {
        taakinstantieId: taak.id,
        actie: "beoordeling.voorleggen",
        verwachteVersie: taak.versie,
        actor: { type: "user", user: rm, rol: "recordmanager" },
      })
    );

    expect(na).toMatchObject({ status: "accordering_po", versie: taak.versie + 1, ronde: taak.ronde });
    const event = await db.prisma.client.auditEvent.findFirstOrThrow({
      where: { taakinstantieId: taak.id, eventType: "Voorgelegd" },
    });
    expect(event).toMatchObject({ actorType: "user", rol: "recordmanager" });
    expect(event.details).toMatchObject({ van: "beoordeling", naar: "accordering_po" });
  });

  it("verhoogt bij terugsturen ook de ronde", async () => {
    const taak = await maakTaak("accordering_po");

    const na = await db.prisma.client.$transaction((tx) =>
      workflow.transition(tx, {
        taakinstantieId: taak.id,
        actie: "accordering_po.terugsturen",
        verwachteVersie: taak.versie,
        actor: { type: "user", user: po, rol: "proceseigenaar" },
      })
    );

    expect(na).toMatchObject({ status: "beoordeling", ronde: taak.ronde + 1 });
  });

  it("geeft 404, 409 en 412 en laat de taak dan ongemoeid", async () => {
    const taak = await maakTaak("beoordeling");
    const poging = (taakinstantieId: string, actie: "beoordeling.voorleggen" | "archiveren", verwachteVersie?: number) =>
      db.prisma.client.$transaction((tx) =>
        workflow.transition(tx, { taakinstantieId, actie, verwachteVersie, actor: { type: "system" } })
      );

    await expect(poging("00000000-0000-0000-0000-000000000001", "beoordeling.voorleggen")).rejects.toThrow(NotFoundException);
    await expect(poging(taak.id, "archiveren")).rejects.toThrow(ConflictException);
    await expect(poging(taak.id, "beoordeling.voorleggen", taak.versie + 5)).rejects.toThrow(PreconditionFailedException);

    expect(await lees(taak.id)).toMatchObject({ status: "beoordeling", versie: taak.versie });
    expect(await auditActies(taak.id)).toEqual([]);
  });

  it("laat van twee gelijktijdige overgangen met dezelfde versie er precies één slagen", async () => {
    const taak = await maakTaak("beoordeling");
    const poging = () =>
      db.prisma.client.$transaction((tx) =>
        workflow.transition(tx, {
          taakinstantieId: taak.id,
          actie: "beoordeling.voorleggen",
          verwachteVersie: taak.versie,
          actor: { type: "user", user: rm, rol: "recordmanager" },
        })
      );

    const uitkomsten = await Promise.allSettled([poging(), poging(), poging()]);

    expect(uitkomsten.filter((uitkomst) => uitkomst.status === "fulfilled")).toHaveLength(1);
    expect(await lees(taak.id)).toMatchObject({ status: "accordering_po", versie: taak.versie + 1 });
    expect(await auditActies(taak.id)).toEqual(["Voorgelegd"]);
  });
});

describe("TakenService: volgorde van foutcodes bij statuswijzigingen", () => {
  it("geeft 404 aan iemand die niet bij de taak betrokken is", async () => {
    const taak = await maakTaak("beoordeling");
    await db.prisma.client.medewerker.create({
      data: { naam: "Buiten", email: "rm2@example.test", rollen: ["recordmanager"], bron: "test", externId: "rm2" },
    });

    await expect(
      taken.beoordeling.beoordelingVoorleggen(gebruiker("rm2", "recordmanager"), taak.id, taak.versie)
    ).rejects.toThrow(NotFoundException);
  });

  it("geeft 403 aan een betrokkene met de verkeerde rol in deze taak", async () => {
    const taak = await maakTaak("beoordeling");

    await expect(taken.beoordeling.beoordelingVoorleggen(po, taak.id, taak.versie)).rejects.toThrow(ForbiddenException);
  });

  it("geeft 409 bij een verkeerde status, ook als er ook een validatiefout zou zijn", async () => {
    const taak = await maakTaak("accordering_po", ["OPGENOMEN"]);

    await expect(taken.beoordeling.beoordelingVoorleggen(rm, taak.id, taak.versie)).rejects.toThrow(ConflictException);
  });

  it("geeft 412 bij een verouderde versie, vóór de validaties", async () => {
    const taak = await maakTaak("beoordeling", ["OPGENOMEN"]);

    await expect(taken.beoordeling.beoordelingVoorleggen(rm, taak.id, taak.versie - 1)).rejects.toThrow(
      PreconditionFailedException
    );
  });

  it("geeft 400 bij openstaande kandidaten en wijzigt dan niets", async () => {
    const taak = await maakTaak("beoordeling", ["AKKOORD", "OPGENOMEN"]);

    await expect(taken.beoordeling.beoordelingVoorleggen(rm, taak.id, taak.versie)).rejects.toThrow(/Openstaand: 1/);
    expect(await lees(taak.id)).toMatchObject({ status: "beoordeling", versie: taak.versie });
  });
});

describe("TakenService: volledige ronde via de WorkflowService", () => {
  it("voorleggen, terugsturen, opnieuw voorleggen, accorderen, vrijgeven en opdracht geven", async () => {
    const taak = await maakTaak("beoordeling", ["AKKOORD", "UITGESLOTEN"]);

    let stand = await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, taak.versie);
    expect(stand.status).toBe("accordering_po");

    // PO stuurt één kandidaat terug: nieuwe ronde.
    await db.prisma.client.vernietigingskandidaat.updateMany({
      where: { selectie: { taakinstantieId: taak.id }, beoordeling: "AKKOORD" },
      data: { beoordeling: "RETOUR" },
    });
    stand = await taken.besluitvorming.proceseigenaarBesluiten(po, taak.id, stand.versie);
    expect(stand.status).toBe("beoordeling");

    await db.prisma.client.vernietigingskandidaat.updateMany({
      where: { selectie: { taakinstantieId: taak.id }, beoordeling: "RETOUR" },
      data: { beoordeling: "AKKOORD" },
    });
    stand = await taken.beoordeling.beoordelingVoorleggen(rm, taak.id, stand.versie);
    stand = await taken.besluitvorming.proceseigenaarBesluiten(po, taak.id, stand.versie);
    expect(stand.status).toBe("accordering_archivaris");
    stand = await taken.besluitvorming.archivarisBesluiten(arch, taak.id, stand.versie);
    expect(stand.status).toBe("vrijgegeven");

    // De UI mag de opdrachtknop alleen tonen als de API het toestaat (CC-13).
    const uitvoeringRm = await taken.uitvoering.getUitvoering(rm, taak.id);
    expect(uitvoeringRm.taak.toegestaneActies).toEqual(["vernietiging.opdracht_geven"]);
    expect(uitvoeringRm.stekkers[0]).toMatchObject({ aantalKandidaten: 1, batchGrootte: 100 });
    expect((await taken.uitvoering.getUitvoering(po, taak.id)).taak.toegestaneActies).toEqual([]);

    const opdracht = await taken.uitvoering.vernietigingsopdracht(rm, taak.id, stand.versie);
    expect(opdracht).toMatchObject({ status: "uitvoering", totaalKandidaten: 1, aantalOpdrachten: 1 });

    expect(await lees(taak.id)).toMatchObject({ ronde: taak.ronde + 1, versie: taak.versie + 6 });
    expect(await auditActies(taak.id)).toEqual([
      "Voorgelegd",
      "Retour",
      "Voorgelegd",
      "Accordering",
      "Accordering",
      // De vrijgave door de archivaris bevriest de lijst (MDTO Bevriezing, met lijsthash).
      "Bevriezing",
      "Vernietigingsopdracht",
    ]);
    const bevriezing = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id, eventType: "Bevriezing" } });
    expect(bevriezing).toMatchObject({ actorType: "system", eventTypeBegrippenlijst: "MDTO EventTypeLijst 1.0" });
    expect(bevriezing.details).toMatchObject({ na: "Accordering", lijstHash: expect.any(String) });
    expect(await db.prisma.client.outbox.count({ where: { taakinstantieId: taak.id, queue: "vernietiging" } })).toBe(1);
  });

  it("maakt geen outbox-jobs aan als de vernietigingsopdracht wordt geweigerd", async () => {
    const taak = await maakTaak("vrijgegeven");

    await expect(taken.uitvoering.vernietigingsopdracht(rm, taak.id, taak.versie + 1)).rejects.toThrow(
      PreconditionFailedException
    );
    expect(await db.prisma.client.outbox.count({ where: { taakinstantieId: taak.id } })).toBe(0);
  });
});

describe("worker-overgangen", () => {
  it("schrijven een audit-event met het systeem als actor", async () => {
    const taak = await maakTaak("uitvoering");

    await db.prisma.client.$transaction((tx) =>
      workflow.transition(tx, {
        taakinstantieId: taak.id,
        actie: "uitvoering.voltooid",
        actor: { type: "system", naam: "Vernietigingscockpit-worker" },
        extraData: { afgerondOp: new Date() },
      })
    );

    const event = await db.prisma.client.auditEvent.findFirstOrThrow({ where: { taakinstantieId: taak.id } });
    expect(event).toMatchObject({ eventType: "Uitvoering afgerond", actorType: "system", actorId: "systeem" });
    expect((await lees(taak.id)).afgerondOp).not.toBeNull();
  });
});

describe("ongeldige id's", () => {
  it("worden door Prisma als 'niet gevonden' of ongeldige UUID gemeld (voor het 404-filter)", async () => {
    const fout = await db.prisma.client.taakinstantie
      .findFirstOrThrow({ where: { id: "geen-uuid" } })
      .catch((error: unknown) => error);

    const { isNietGevonden } = await import("../../src/shared/http/niet-gevonden.filter.js");
    expect(isNietGevonden(fout), String(fout)).toBe(true);
  });
});
