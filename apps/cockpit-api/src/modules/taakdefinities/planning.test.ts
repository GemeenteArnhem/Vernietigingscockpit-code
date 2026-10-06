import { describe, expect, it } from "vitest";
import { eersteStartdatum, naamVoorCyclus, nogGepland, volgendeStartdatum } from "./planning.js";

const dag = (tekst: string) => new Date(`${tekst}T00:00:00Z`);
const tekst = (datum: Date | null) => datum?.toISOString().slice(0, 10) ?? null;

describe("eerste startdatum", () => {
  it("jaarlijks: de startmaand van dit jaar als die nog moet komen of nu is, anders volgend jaar", () => {
    expect(tekst(eersteStartdatum("jaarlijks", 11, dag("2026-10-06")))).toBe("2026-11-01");
    expect(tekst(eersteStartdatum("jaarlijks", 10, dag("2026-10-06")))).toBe("2026-10-01");
    expect(tekst(eersteStartdatum("jaarlijks", 3, dag("2026-10-06")))).toBe("2027-03-01");
  });

  it("kwartaal: de eerstvolgende maand in de cadans vanaf de startmaand", () => {
    expect(tekst(eersteStartdatum("kwartaal", 1, dag("2026-10-06")))).toBe("2026-10-01");
    expect(tekst(eersteStartdatum("kwartaal", 2, dag("2026-10-06")))).toBe("2026-11-01");
    expect(tekst(eersteStartdatum("kwartaal", 9, dag("2026-12-15")))).toBe("2026-12-01");
    expect(tekst(eersteStartdatum("kwartaal", 2, dag("2026-12-15")))).toBe("2027-02-01");
  });

  it("maandelijks: de 1e van de volgende maand", () => {
    expect(tekst(eersteStartdatum("maandelijks", null, dag("2026-10-06")))).toBe("2026-11-01");
    expect(tekst(eersteStartdatum("maandelijks", null, dag("2026-12-31")))).toBe("2027-01-01");
  });

  it("ad hoc: niet gepland", () => {
    expect(eersteStartdatum("ad_hoc", null, dag("2026-10-06"))).toBeNull();
  });

  it("jaarlijks of kwartaal zonder startmaand is een fout", () => {
    expect(() => eersteStartdatum("jaarlijks", null, dag("2026-10-06"))).toThrow(/startmaand/);
  });
});

describe("volgende startdatum", () => {
  it("één cyclus na de vorige", () => {
    expect(tekst(volgendeStartdatum("jaarlijks", 11, dag("2026-11-01"), dag("2027-02-10")))).toBe("2027-11-01");
    expect(tekst(volgendeStartdatum("kwartaal", 2, dag("2026-11-01"), dag("2026-12-10")))).toBe("2027-02-01");
    expect(tekst(volgendeStartdatum("maandelijks", null, dag("2026-11-01"), dag("2026-11-20")))).toBe("2026-12-01");
  });

  it("slaat gemiste cycli over, binnen de cadans", () => {
    expect(tekst(volgendeStartdatum("kwartaal", 2, dag("2026-02-01"), dag("2026-12-10")))).toBe("2027-02-01");
    expect(tekst(volgendeStartdatum("jaarlijks", 3, dag("2024-03-01"), dag("2026-10-06")))).toBe("2027-03-01");
  });
});

describe("naam en status", () => {
  it("naam per cyclus", () => {
    expect(naamVoorCyclus("Sociaal domein", "jaarlijks", dag("2027-03-01"))).toBe("Sociaal domein 2027");
    expect(naamVoorCyclus("Sociaal domein", "kwartaal", dag("2026-11-01"))).toBe("Sociaal domein Q4 2026");
    expect(naamVoorCyclus("Sociaal domein", "maandelijks", dag("2026-11-01"))).toBe("Sociaal domein november 2026");
  });

  it("gepland zolang de startdatum na vandaag ligt", () => {
    expect(nogGepland(dag("2026-11-01"), new Date("2026-10-31T23:00:00Z"))).toBe(true);
    expect(nogGepland(dag("2026-11-01"), new Date("2026-11-01T08:00:00Z"))).toBe(false);
    expect(nogGepland(null, new Date())).toBe(false);
  });
});
