// Toegankelijkheidscontrole (WCAG 2.1 AA, NeRDS-leidraad H2) met axe-core op de gerenderde DOM.
// Contrast kan jsdom niet meten (geen echte opmaak); die regel staat daarom uit.
import axe from "axe-core";

export type AxeOvertreding = { regel: string; impact: string | null; aantal: number; hulp: string };

export async function controleerToegankelijkheid(element: Element = document.body): Promise<AxeOvertreding[]> {
  const resultaat = await axe.run(element, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });

  return resultaat.violations
    .map((v) => ({ regel: v.id, impact: v.impact ?? null, aantal: v.nodes.length, hulp: v.help }))
    .sort((a, b) => a.regel.localeCompare(b.regel));
}
