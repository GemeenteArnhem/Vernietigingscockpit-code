import { ConflictException, HttpException, PreconditionFailedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { isNietGevonden } from "../../shared/http/niet-gevonden.filter.js";
import { leesIfMatch } from "./if-match.js";
import { isTerugsturen, TAAK_STATUSSEN, TRANSITIES, type TransitieActie } from "./transitions.js";
import { WorkflowService } from "./workflow.service.js";

const workflow = new WorkflowService();
const acties = Object.keys(TRANSITIES) as TransitieActie[];

describe("transitietabel", () => {
  it("volgt de toestandsmachine (ADR-0002)", () => {
    const paden = Object.fromEntries(acties.map((actie) => [actie, `${TRANSITIES[actie].van} -> ${TRANSITIES[actie].naar}`]));

    expect(paden).toEqual({
      "selectie.voltooid": "init -> beoordeling",
      "beoordeling.voorleggen": "beoordeling -> accordering_po",
      "accordering_po.goedkeuren": "accordering_po -> accordering_archivaris",
      "accordering_po.terugsturen": "accordering_po -> beoordeling",
      "accordering_archivaris.vrijgeven": "accordering_archivaris -> vrijgegeven",
      "accordering_archivaris.terugsturen": "accordering_archivaris -> beoordeling",
      "vernietiging.opdracht_geven": "vrijgegeven -> uitvoering",
      "uitvoering.voltooid": "uitvoering -> resultaat",
      archiveren: "resultaat -> archief",
    });
  });

  it("laat alleen het systeem selectie en uitvoering afronden", () => {
    const systeem = acties.filter((actie) => TRANSITIES[actie].door === "systeem");
    expect(systeem).toEqual(["selectie.voltooid", "uitvoering.voltooid"]);
  });

  it("begint alleen bij terugsturen een nieuwe ronde", () => {
    expect(acties.filter(isTerugsturen)).toEqual(["accordering_po.terugsturen", "accordering_archivaris.terugsturen"]);
  });

  it("kent geen overgang uit archief", () => {
    expect(acties.map((actie) => TRANSITIES[actie].van as string)).not.toContain("archief");
  });
});

describe("controleerVooraf: elke status x elke actie", () => {
  const gevallen = TAAK_STATUSSEN.flatMap((status) => acties.map((actie) => [status, actie] as const));

  it.each(gevallen)("status %s, actie %s", (status, actie) => {
    const controle = () => workflow.controleerVooraf({ status, versie: 3 }, actie, 3);

    if (TRANSITIES[actie].van === status) {
      expect(controle).not.toThrow();
    } else {
      expect(controle).toThrow(ConflictException);
    }
  });

  it("geeft 412 bij een verouderde versie in de juiste status", () => {
    expect(() =>
      workflow.controleerVooraf({ status: "beoordeling", versie: 4 }, "beoordeling.voorleggen", 3)
    ).toThrow(PreconditionFailedException);
  });

  it("geeft 412 vóór 409: een verouderde versie bij een intussen gewijzigde status", () => {
    expect(() =>
      workflow.controleerVooraf({ status: "accordering_po", versie: 4 }, "beoordeling.voorleggen", 3)
    ).toThrow(PreconditionFailedException);
  });

  it("controleert geen versie als die niet is meegegeven (systeemovergang)", () => {
    expect(() => workflow.controleerVooraf({ status: "init", versie: 9 }, "selectie.voltooid")).not.toThrow();
  });
});

describe("leesIfMatch", () => {
  it.each([
    ["3", 3],
    ['"3"', 3],
    ['W/"12"', 12],
    [' "7" ', 7],
  ])("leest %s als versie %d", (header, versie) => {
    expect(leesIfMatch(header)).toBe(versie);
  });

  it("geeft 428 zonder header", () => {
    for (const header of [undefined, "", "  "]) {
      try {
        leesIfMatch(header);
        expect.unreachable();
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(428);
      }
    }
  });

  it.each(["*", "abc", '"3", "4"', "-1", "1.5"])("geeft 400 bij %s", (header) => {
    expect(() => leesIfMatch(header)).toThrow(/geen geldige taakversie/);
  });
});

describe("isNietGevonden", () => {
  const prismaFout = (code: string) => Object.assign(new Error("x"), { name: "PrismaClientKnownRequestError", code });

  it("herkent Prisma 'niet gevonden' en een ongeldige UUID", () => {
    expect(isNietGevonden(prismaFout("P2025"))).toBe(true);
    expect(isNietGevonden(prismaFout("P2023"))).toBe(true);
    expect(isNietGevonden(new Error('invalid input syntax for type uuid: "abc"'))).toBe(true);
  });

  it("laat andere fouten met rust", () => {
    expect(isNietGevonden(prismaFout("P2002"))).toBe(false);
    expect(isNietGevonden(new Error("iets anders"))).toBe(false);
    expect(isNietGevonden("geen error")).toBe(false);
  });
});
