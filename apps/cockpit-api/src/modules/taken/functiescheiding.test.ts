import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { controleerFunctiescheiding } from "./taken-hulp.js";

describe("controleerFunctiescheiding", () => {
  it("laat een besluit toe als de medewerker geen eerdere rol in de taak heeft", () => {
    expect(() => controleerFunctiescheiding("arch", ["rm", "po"])).not.toThrow();
  });

  it.each([
    ["proceseigenaar die ook indiener is", "rm", ["rm"]],
    ["archivaris die ook recordmanager is", "rm", ["rm", "po"]],
    ["archivaris die ook proceseigenaar is", "po", ["rm", "po"]],
  ])("weigert een %s met 403", (_omschrijving, medewerker, eerdereRollen) => {
    expect(() => controleerFunctiescheiding(medewerker, eerdereRollen)).toThrow(ForbiddenException);
  });
});
