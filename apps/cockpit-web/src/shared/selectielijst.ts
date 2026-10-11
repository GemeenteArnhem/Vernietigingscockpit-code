// Selectielijst van een kandidaat (ADR-0008): tabellen en filters tonen de selectielijstcode,
// de tooltip en het detailpaneel de volledige titel uit het register Cockpit-selectielijsten
// (of de melding dat de code daar niet in staat).

export const SELECTIELIJST_UITLEG =
  "Code van de vastgestelde selectielijst die van toepassing is, uit het register Cockpit-selectielijsten (bijv. GEM-2020 = Selectielijst gemeenten en intergemeentelijke organen 2020).";

// Waarde voor het detailpaneel: de code met daaronder de titel. Zonder titel, of als er meerdere
// selectielijsten zijn, alleen de code (of de melding).
export function selectielijstDetail(code?: string, naam?: string) {
  if (!code || code === "-") {
    return "-";
  }

  return naam && naam !== "-" && naam !== code ? `${code}\n${naam}` : code;
}

// Tooltip op de waarde: alleen een echte titel, niet "-" of "Meerdere selectielijsten".
export function selectielijstTitel(naam?: string) {
  return naam && naam !== "-" && !naam.startsWith("Meerdere") ? naam : undefined;
}
