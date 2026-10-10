import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUDIT_EVENTTYPEN, BEGRIPPENLIJST_MDTO, CONFIGURATIE_EVENTTYPEN } from "./audit-eventtypen.js";

// De eventtypen in de code moeten precies de labels uit de begrippenlijsten zijn (ADR-0005 §5).
// Staat de architectuurrepo naast deze repo, dan wordt dat tegen de lijsten zelf gecontroleerd.
const lijsten = new URL("../../../../../../Vernietigingscockpit/designrules/begrippenlijsten/", import.meta.url);

function lees(bestand: string) {
  try {
    return readFileSync(new URL(bestand, lijsten), "utf8");
  } catch {
    return null;
  }
}

describe("audit-eventtypen", () => {
  it("gebruikt voor MDTO-begrippen alleen labels uit de MDTO EventTypeLijst", () => {
    const mdto = ["Creatie", "Import", "Accordering", "Bevriezing", "Vernietigen", "Export"];
    const uitMdto = Object.entries(AUDIT_EVENTTYPEN).filter(([, lijst]) => lijst === BEGRIPPENLIJST_MDTO).map(([label]) => label);
    expect(uitMdto.sort()).toEqual(mdto.sort());
  });

  it.runIf(lees("cockpit-eventtypen.md") !== null)("komt overeen met de begrippenlijst Cockpit-eventtypen", () => {
    const tekst = lees("cockpit-eventtypen.md")!;
    for (const [label, lijst] of Object.entries(AUDIT_EVENTTYPEN)) {
      expect(tekst, label).toContain(lijst === BEGRIPPENLIJST_MDTO ? `| ${label} |` : `| ${label} | `);
    }
  });

  it.runIf(lees("cockpit-configuratie-eventtypen.md") !== null)("komt overeen met de begrippenlijst Cockpit-configuratie-eventtypen", () => {
    const tekst = lees("cockpit-configuratie-eventtypen.md")!;
    for (const label of CONFIGURATIE_EVENTTYPEN) {
      expect(tekst, label).toContain(`| ${label} |`);
    }
  });
});
