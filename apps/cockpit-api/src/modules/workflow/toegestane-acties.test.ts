import { describe, expect, it } from "vitest";
import { taakdefinitieActies, taakinstantieActies } from "./toegestane-acties.js";

const taak = (status: string, selecties: unknown[] = []) => ({
  status,
  selecties,
  recordmanager: { id: "rm" },
  proceseigenaar: { id: "po" },
  archivaris: { id: "arch" },
});

describe("taakinstantieActies", () => {
  it("geeft de gekoppelde recordmanager in init de actie selectie.starten", () => {
    expect(taakinstantieActies(taak("init"), { roles: ["recordmanager"], medewerkerId: "rm" })).toEqual([
      "selectie.starten",
    ]);
  });

  it("geeft selectie.starten niet meer zodra er selecties zijn", () => {
    expect(taakinstantieActies(taak("init", [{}]), { roles: ["recordmanager"], medewerkerId: "rm" })).toEqual([]);
  });

  it("geeft een recordmanager die niet aan de taak gekoppeld is geen acties", () => {
    expect(taakinstantieActies(taak("beoordeling"), { roles: ["recordmanager"], medewerkerId: "iemand-anders" })).toEqual([]);
  });

  it.each([
    ["beoordeling", ["recordmanager"], "rm", ["kandidaat.beoordelen", "beoordeling.voorleggen"]],
    ["accordering_po", ["proceseigenaar"], "po", ["accordering_po.besluiten"]],
    ["accordering_archivaris", ["archivaris"], "arch", ["accordering_archivaris.besluiten"]],
    ["vrijgegeven", ["recordmanager"], "rm", ["vernietiging.opdracht_geven"]],
    ["accordering_po", ["recordmanager"], "rm", []],
    ["uitvoering", ["recordmanager"], "rm", []],
  ])("status %s, rol %s → %j", (status, roles, medewerkerId, verwacht) => {
    expect(taakinstantieActies(taak(status), { roles, medewerkerId })).toEqual(verwacht);
  });

  it("geeft een auditor geen muterende acties", () => {
    for (const status of ["init", "beoordeling", "accordering_po", "accordering_archivaris", "vrijgegeven"]) {
      expect(taakinstantieActies(taak(status), { roles: ["auditor"], medewerkerId: "rm" })).toEqual([]);
    }
  });
});

describe("taakdefinitieActies", () => {
  it("laat alleen de eigen recordmanager bewerken; beheer en auditor alleen lezen", () => {
    const definitie = taak("init");
    expect(taakdefinitieActies(definitie, { roles: ["recordmanager"], medewerkerId: "rm" })).toEqual([
      "taakdefinitie.bewerken",
      "taakinstantie.aanmaken",
    ]);
    expect(taakdefinitieActies(definitie, { roles: ["functioneel_beheerder"], medewerkerId: null })).toEqual([
      "taakdefinitie.lezen",
    ]);
    expect(taakdefinitieActies(definitie, { roles: ["auditor"], medewerkerId: null })).toEqual(["taakdefinitie.lezen"]);
  });
});
