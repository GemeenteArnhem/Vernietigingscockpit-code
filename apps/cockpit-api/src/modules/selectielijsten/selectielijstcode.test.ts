import { describe, expect, it } from "vitest";
import { SELECTIELIJSTEN } from "./register.js";
import { ONBEKENDE_SELECTIELIJST, SELECTIELIJSTCODE_PATROON, selectielijstWeergave } from "./selectielijstcode.js";

// Register Cockpit-selectielijsten (ADR-0008): uniek en volgens het formaat (DR-SL-01, DR-SL-03).
describe("selectielijstcode", () => {
  it("het register bevat alleen geldige codes, met de gemeentelijke lijsten", () => {
    expect(SELECTIELIJSTEN.size).toBeGreaterThan(500);
    for (const code of SELECTIELIJSTEN.keys()) {
      expect(code).toMatch(SELECTIELIJSTCODE_PATROON);
    }
    expect(SELECTIELIJSTEN.get("GEM-2020")).toBe("Selectielijst gemeenten en intergemeentelijke organen 2020");
    expect(SELECTIELIJSTEN.has("GEM-2012")).toBe(true);
    expect(SELECTIELIJSTEN.has("GEM-2017")).toBe(true);
  });

  it("toont de titel uit het register, of de vaste melding bij een onbekende code", () => {
    expect(selectielijstWeergave("GEM-2020")).toEqual({
      code: "GEM-2020",
      naam: "Selectielijst gemeenten en intergemeentelijke organen 2020",
      bekend: true,
    });
    expect(selectielijstWeergave("GEM-2099")).toEqual({ code: "GEM-2099", naam: ONBEKENDE_SELECTIELIJST, bekend: false });
  });
});
