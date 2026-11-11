import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gebruiker, maakBasisdata } from "./helpers/basisdata.js";
import { startDatabase, type TestDatabase } from "./helpers/database.js";
import { maakTaakServices, type TaakServices } from "./helpers/taken.js";

// Het takenoverzicht (GET /taken): "mijn" is de werkvoorraad, "alle" alles wat de gebruiker
// mag inzien. Proceseigenaar en archivaris hebben alleen werk in hun accorderingsstap.

type Status = "init" | "beoordeling" | "accordering_po" | "accordering_archivaris" | "vrijgegeven" | "archief";

let db: TestDatabase;
let basis: Awaited<ReturnType<typeof maakBasisdata>>;
let taken: TaakServices;
const ids = {} as Record<Status, string>;
const rm = gebruiker("rm1", "recordmanager");
const po = gebruiker("po1", "proceseigenaar");
const arch = gebruiker("arch1", "archivaris");

beforeAll(async () => {
  db = await startDatabase();
  basis = await maakBasisdata(db.prisma);
  taken = maakTaakServices(db);
  ids.init = basis.taak.id;

  for (const status of ["beoordeling", "accordering_po", "accordering_archivaris", "vrijgegeven", "archief"] as const) {
    const taak = await db.prisma.client.taakinstantie.create({
      data: {
        taakdefinitieId: basis.taakdefinitie.id,
        naam: `Taak ${status}`,
        status,
        recordmanagerId: basis.rm.id,
        proceseigenaarId: basis.po.id,
        archivarisId: basis.arch.id,
        archiefvormer: { verwijzingNaam: "Gemeente Test" },
      },
    });
    ids[status] = taak.id;
  }
});

afterAll(async () => {
  await db?.stop();
});

const overzicht = async (user: typeof rm, scope: "mijn" | "alle") =>
  (await taken.toegang.getTaken(user, scope)).map((taak) => taak.id).sort();

const alleIds = () => Object.values(ids).sort();

describe("werkvoorraad", () => {
  it("toont de proceseigenaar alleen eigen uitvoeringen in accordering door de proceseigenaar", async () => {
    expect(await overzicht(po, "mijn")).toEqual([ids.accordering_po]);
  });

  it("toont de archivaris alleen eigen uitvoeringen in accordering door de archivaris", async () => {
    expect(await overzicht(arch, "mijn")).toEqual([ids.accordering_archivaris]);
  });

  it("toont de recordmanager al zijn uitvoeringen", async () => {
    expect(await overzicht(rm, "mijn")).toEqual(alleIds());
  });
});

describe("alle", () => {
  it("laat proceseigenaar en archivaris ook eerder geaccordeerde uitvoeringen inzien", async () => {
    expect(await overzicht(po, "alle")).toEqual(alleIds());
    expect(await overzicht(arch, "alle")).toEqual(alleIds());
  });

  it("houdt taakdetails buiten de werkvoorraad bereikbaar", async () => {
    const { taak } = await taken.toegang.getTaak(po, ids.archief);
    expect(taak.id).toBe(ids.archief);
  });
});
