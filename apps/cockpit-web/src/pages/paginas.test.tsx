// Smoketest per pagina (NeRDS-leidraad 13.1 en H2): elke route rendert met de nep-API zonder
// fouten, roept alleen bekende endpoints aan en heeft geen nieuwe toegankelijkheidsfouten
// (WCAG 2.1 A/AA volgens axe, zonder contrast).
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRole } from "../auth/authConfig";
import { controleerToegankelijkheid } from "../test/axe";
import { installeerNepApi, standaardRoutes } from "../test/nepApi";
import { renderApp } from "../test/renderApp";

type Pagina = {
  naam: string;
  pad: string;
  rollen: AppRole[];
  taakStatus: string;
  // Tekst die zichtbaar moet zijn als de pagina met gegevens is geladen.
  verwacht: string;
  // Bekende toegankelijkheidsfouten (axe-regel-id's), vastgelegd op 2026-11-13. Niet opgelost
  // omdat dat een UI-wijziging is; zie de opmerking bij de pagina. Haal een regel hier weg
  // zodra die is opgelost; een nieuwe overtreding laat de test falen.
  bekendeA11yFouten?: string[];
};

const PAGINAS: Pagina[] = [
  {
    naam: "dashboard",
    pad: "/dashboard",
    rollen: ["recordmanager"],
    taakStatus: "BEOORDELING",
    verwacht: "Vernietiging zaken 2026",
    // DashboardRecordPanel: aria-label op een <div> zonder rol (aria-prohibited-attr, serious).
    bekendeA11yFouten: ["aria-prohibited-attr"],
  },
  { naam: "stekkers", pad: "/stekkers", rollen: ["functioneel_beheerder"], taakStatus: "BEOORDELING", verwacht: "Zaaksysteem" },
  { naam: "nieuwe stekker", pad: "/stekkers/nieuw", rollen: ["functioneel_beheerder"], taakStatus: "BEOORDELING", verwacht: "Stekkers - nieuw" },
  {
    naam: "stekker bewerken",
    pad: "/stekkers/s-1/bewerken",
    rollen: ["functioneel_beheerder"],
    taakStatus: "BEOORDELING",
    verwacht: "Stekkers - Zaaksysteem bewerken",
  },
  { naam: "nieuwe taak", pad: "/taak/nieuw", rollen: ["recordmanager"], taakStatus: "BEOORDELING", verwacht: "Taken - nieuw" },
  { naam: "taakdefinitie", pad: "/taak/1", rollen: ["recordmanager"], taakStatus: "BEOORDELING", verwacht: "Jaarlijkse vernietiging zaken" },
  {
    naam: "selectie",
    pad: "/taak/1/taakuitvoering/1/selectie",
    rollen: ["recordmanager"],
    taakStatus: "SELECTIE",
    verwacht: "Selectie is klaar voor beoordeling",
  },
  {
    naam: "beoordeling",
    pad: "/taak/1/taakuitvoering/1/beoordeling",
    rollen: ["recordmanager"],
    taakStatus: "BEOORDELING",
    verwacht: "Omgevingsvergunning 1",
  },
  {
    naam: "accordering proceseigenaar",
    pad: "/taak/1/taakuitvoering/1/accordering/proceseigenaar",
    rollen: ["proceseigenaar"],
    taakStatus: "ACCORDERING_PO",
    verwacht: "Omgevingsvergunning 1",
  },
  {
    naam: "accordering archivaris",
    pad: "/taak/1/taakuitvoering/1/accordering/archivaris",
    rollen: ["archivaris"],
    taakStatus: "ACCORDERING_ARCH",
    verwacht: "Omgevingsvergunning 1",
  },
  {
    naam: "uitvoering",
    pad: "/taak/1/taakuitvoering/1/uitvoering",
    rollen: ["recordmanager"],
    taakStatus: "UITVOERING",
    verwacht: "Zaaksysteem",
  },
  {
    naam: "resultaat",
    pad: "/taak/1/taakuitvoering/1/resultaat",
    rollen: ["recordmanager"],
    taakStatus: "AFGEROND",
    verwacht: "Omgevingsvergunning 1",
  },
];

describe("pagina's", () => {
  let consoleFouten: unknown[][];

  beforeEach(() => {
    consoleFouten = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      consoleFouten.push(args);
    });
  });

  afterEach(() => {
    expect(consoleFouten, "console.error tijdens het renderen").toEqual([]);
  });

  for (const pagina of PAGINAS) {
    it(`${pagina.naam} rendert, gebruikt bekende endpoints en is toegankelijk`, async () => {
      const api = installeerNepApi(standaardRoutes(pagina.taakStatus));

      renderApp(pagina.pad, pagina.rollen);

      expect((await screen.findAllByText(pagina.verwacht, { exact: false })).length).toBeGreaterThan(0);
      // Laat lopende verzoeken en state-updates afronden voor de axe-controle.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(window.location.pathname).toBe(pagina.pad);
      expect(api.onbekend).toEqual([]);

      const overtredingen = await controleerToegankelijkheid();
      expect(overtredingen.map((o) => o.regel)).toEqual(pagina.bekendeA11yFouten ?? []);
    });
  }
});

describe("toegang per rol", () => {
  it("stuurt een gebruiker zonder de juiste rol terug naar het dashboard", async () => {
    installeerNepApi();

    renderApp("/stekkers", ["recordmanager"]);

    expect(await screen.findByText("Vernietiging zaken 2026")).toBeTruthy();
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("stuurt een functioneel beheerder zonder dashboard naar Taken", async () => {
    installeerNepApi();

    renderApp("/dashboard", ["functioneel_beheerder"]);

    expect(await screen.findAllByText("Jaarlijkse vernietiging zaken")).not.toHaveLength(0);
    expect(window.location.pathname).toBe("/taak/1");
  });
});
