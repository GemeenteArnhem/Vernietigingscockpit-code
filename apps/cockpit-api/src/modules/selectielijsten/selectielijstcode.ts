import type { ApiSelectielijst } from "@vernietigingscockpit/api-contract";
import { SELECTIELIJSTEN } from "./register.js";

// Selectielijstcode (ADR-0008): het kenmerk van de vastgestelde selectielijst in
// `informatiecategorie.begripBegrippenlijst.verwijzingIdentificatie`, uitgegeven door de
// begrippenlijst Cockpit-selectielijsten.
export const SELECTIELIJSTCODE_PATROON = /^[A-Z][A-Z0-9]{1,11}-[0-9]{4}(\.[0-9]{2})?$/;
export const SELECTIELIJSTEN_BRON = "Cockpit-selectielijsten";
export const ONBEKENDE_SELECTIELIJST = "Onbekende selectielijstcode (niet in Cockpit-selectielijsten)";

type Verwijzing = {
  verwijzingNaam: string;
  verwijzingIdentificatie?: { identificatieKenmerk: string; identificatieBron: string };
};

// De code uit de verwijzing van de stekker. Ontbreekt hij, heeft hij een ander formaat of een
// andere bron, dan schendt de kandidaat het contract (DR-SL-06 punt 2). Staat hij niet in het
// register, dan blijft de kandidaat, met een waarschuwing (punt 3).
export function selectielijstUitVerwijzing(kandidaatId: string, verwijzing: Verwijzing) {
  const identificatie = verwijzing.verwijzingIdentificatie;
  const code = identificatie?.identificatieKenmerk?.trim();

  if (!code || !SELECTIELIJSTCODE_PATROON.test(code) || identificatie?.identificatieBron !== SELECTIELIJSTEN_BRON) {
    throw new Error(
      `Kandidaat ${kandidaatId} mist een geldige selectielijstcode in informatiecategorie.begripBegrippenlijst.verwijzingIdentificatie (ADR-0008).`
    );
  }

  return { code, bekend: SELECTIELIJSTEN.has(code) };
}

// Weergave: de titel uit het register, of de vaste melding als de code onbekend is.
export function selectielijstWeergave(code: string): ApiSelectielijst {
  const titel = SELECTIELIJSTEN.get(code);
  return titel ? { code, naam: titel, bekend: true } : { code, naam: ONBEKENDE_SELECTIELIJST, bekend: false };
}
