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

    // Geplande uitvoering (terugkerende taak): pas vanaf de startdatum.
    const morgen = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const gisteren = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(taakinstantieActies({ ...taak("init"), geplandOp: morgen }, { roles: ["recordmanager"], medewerkerId: "rm" })).toEqual([]);
    expect(taakinstantieActies({ ...taak("init"), geplandOp: gisteren }, { roles: ["recordmanager"], medewerkerId: "rm" })).toEqual([
      "selectie.starten",
    ]);
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
  it("laat alleen de eigen recordmanager bewerken; de beheerder maakt aan en verwijdert; de auditor leest", () => {
    const definitie = taak("init");
    expect(taakdefinitieActies(definitie, { roles: ["recordmanager"], medewerkerId: "rm" })).toEqual([
      "taakdefinitie.bewerken",
      "taakinstantie.aanmaken",
    ]);
    expect(taakdefinitieActies(definitie, { roles: ["functioneel_beheerder"], medewerkerId: null })).toEqual([
      "taakdefinitie.lezen",
      "taakinstantie.aanmaken",
      "taakdefinitie.verwijderen",
    ]);
    expect(taakdefinitieActies(definitie, { roles: ["auditor"], medewerkerId: null })).toEqual(["taakdefinitie.lezen"]);
  });
});

describe("taakinstantie verwijderen (functioneel beheerder)", () => {
  const beheerder = { roles: ["functioneel_beheerder"], medewerkerId: null };

  it("mag vóór de vernietiging en na archivering", () => {
    for (const status of ["init", "beoordeling", "accordering_po", "accordering_archivaris", "vrijgegeven", "archief"]) {
      expect(taakinstantieActies(taak(status), beheerder), status).toContain("taakinstantie.verwijderen");
    }
  });

  it("mag niet vanaf de vernietiging tot de archivering, en niet tijdens een lopende selectie", () => {
    expect(taakinstantieActies(taak("uitvoering"), beheerder)).not.toContain("taakinstantie.verwijderen");
    expect(taakinstantieActies(taak("resultaat"), beheerder)).not.toContain("taakinstantie.verwijderen");
    expect(taakinstantieActies(taak("init", [{ status: "RUNNING" }]), beheerder)).not.toContain("taakinstantie.verwijderen");
    expect(taakinstantieActies(taak("beoordeling", [{ status: "GEIMPORTEERD" }]), beheerder)).toContain("taakinstantie.verwijderen");
  });

  it("andere rollen kunnen niet verwijderen", () => {
    expect(taakinstantieActies(taak("init"), { roles: ["recordmanager"], medewerkerId: "rm" })).not.toContain("taakinstantie.verwijderen");
  });
});
