import { describe, expect, it } from "vitest";
import { berekenHash, canoniekeJson, controleerKeten, type KetenRij } from "./audit-keten.js";

const basisRij = (overrides: Partial<KetenRij> = {}): KetenRij => ({
  taakinstantieId: "taak-1",
  tijdstip: new Date("2026-10-02T10:00:00.123Z"),
  actorType: "user",
  actorId: "sub-rm1",
  actorNaam: "rm1",
  rol: "recordmanager",
  actie: "REVIEW_SUBMITTED",
  entiteitType: "taakinstantie",
  entiteitId: "taak-1",
  details: { totaal: 3, akkoord: 2 },
  correlatieId: "c-1",
  vorigeHash: null,
  ...overrides,
});

describe("canoniekeJson", () => {
  it("is onafhankelijk van de volgorde van sleutels, ook genest", () => {
    expect(canoniekeJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(
      canoniekeJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 })
    );
    expect(canoniekeJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("laat undefined weg, zoals jsonb dat ook doet", () => {
    expect(canoniekeJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("berekenHash", () => {
  it("dekt elke kolom: een wijziging in één veld geeft een andere hash", () => {
    const origineel = berekenHash(basisRij());
    const wijzigingen: Partial<KetenRij>[] = [
      { taakinstantieId: "taak-2" },
      { tijdstip: new Date("2026-10-02T10:00:00.124Z") },
      { actorType: "system" },
      { actorId: "sub-po1" },
      { actorNaam: "iemand" },
      { rol: "proceseigenaar" },
      { actie: "APPROVAL_GRANTED" },
      { entiteitType: "vernietigingskandidaat" },
      { entiteitId: "taak-2" },
      { details: { totaal: 3, akkoord: 3 } },
      { correlatieId: "c-2" },
      { vorigeHash: "abc" },
    ];

    for (const wijziging of wijzigingen) {
      expect(berekenHash(basisRij(wijziging)), JSON.stringify(wijziging)).not.toBe(origineel);
    }
  });

  it("geeft dezelfde hash bij andere sleutelvolgorde in details", () => {
    expect(berekenHash(basisRij({ details: { akkoord: 2, totaal: 3 } }))).toBe(berekenHash(basisRij()));
  });
});

describe("controleerKeten", () => {
  const keten = () => {
    const eerste = basisRij();
    const h1 = berekenHash(eerste);
    const tweede = basisRij({ actie: "APPROVAL_GRANTED", vorigeHash: h1 });
    const h2 = berekenHash(tweede);
    return [
      { ...eerste, id: 1n, hash: h1 },
      { ...tweede, id: 2n, hash: h2 },
    ];
  };

  it("keurt een intacte keten goed", () => {
    expect(controleerKeten(keten()).fouten).toEqual([]);
  });

  it("vindt een gewijzigde inhoud", () => {
    const rijen = keten();
    rijen[1] = { ...rijen[1], details: { gewijzigd: true } };
    expect(controleerKeten(rijen).fouten).toEqual([{ id: "2", reden: "hash" }]);
  });

  it("vindt een vertakking of ontbrekende schakel", () => {
    const rijen = keten();
    const los = basisRij({ actie: "APPROVAL_REJECTED", vorigeHash: rijen[0].hash });
    rijen.push({ ...los, id: 3n, hash: berekenHash(los) });
    expect(controleerKeten(rijen).fouten).toEqual([{ id: "3", reden: "schakel" }]);
  });
});
