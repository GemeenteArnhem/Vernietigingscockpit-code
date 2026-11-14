// Nep-API voor tests: vervangt `fetch` en beantwoordt GET-verzoeken van de web-app met de
// testgegevens uit fixtures.ts. Onbekende verzoeken krijgen 404 en komen in `onbekend`, zodat
// een test kan zien welke endpoints een pagina aanroept die hier nog ontbreken.
import { vi } from "vitest";

import * as f from "./fixtures";

type Antwoord = { status?: number; body?: unknown };
type Route = { methode: string; pad: RegExp; antwoord: (match: RegExpMatchArray) => Antwoord };

const BASIS = "/api/v1";

export function standaardRoutes(taakStatus = "BEOORDELING"): Route[] {
  const get = (pad: RegExp, body: unknown): Route => ({ methode: "GET", pad, antwoord: () => ({ body }) });

  return [
    get(/^\/me$/, f.me),
    get(/^\/taken\?scope=/, [f.taakinstantie(taakStatus)]),
    get(/^\/taakdefinities\?scope=/, [f.taakdefinitie]),
    get(/^\/taakdefinities\/[^/?]+$/, f.taakdefinitie),
    get(/^\/stekkers$/, f.stekkerOpties),
    get(/^\/stamgegevens\/medewerkers\?rol=/, f.medewerkers),
    get(/^\/beheer\/stekkers$/, [f.stekkerBeheer]),
    get(/^\/beheer\/stekkers\/[^/]+$/, f.stekkerBeheer),
    get(/^\/taken\/[^/]+\/selectie$/, f.selectie),
    get(/^\/taken\/[^/]+\/kandidaten\/samenvatting/, f.samenvatting),
    get(/^\/taken\/[^/]+\/kandidaten\/ids/, { ids: f.kandidatenPagina.kandidaten.map((k) => k.id) }),
    get(/^\/taken\/[^/]+\/kandidaten(\?|$)/, { ...f.kandidatenPagina, taak: { ...f.kandidatenPagina.taak, status: taakStatus } }),
    get(/^\/taken\/[^/]+\/uitvoering$/, f.uitvoering),
    get(/^\/taken\/[^/]+\/vernietigingsresultaten$/, f.resultaten),
    get(/^\/taken\/[^/]+\/verklaring$/, f.verklaring),
    get(/^\/taken\/[^/]+\/archivering$/, f.archivering),
    get(/^\/taken\/[^/?]+$/, f.taakinstantie(taakStatus)),
  ];
}

export function installeerNepApi(routes: Route[] = standaardRoutes()) {
  const onbekend: string[] = [];
  const aanroepen: string[] = [];

  const nepFetch = vi.fn(async (invoer: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof invoer === "string" ? invoer : invoer instanceof URL ? invoer.href : invoer.url;
    const methode = (init?.method ?? "GET").toUpperCase();
    const pad = url.startsWith(BASIS) ? url.slice(BASIS.length) : url;
    aanroepen.push(`${methode} ${pad}`);

    for (const route of routes) {
      const match = route.methode === methode ? pad.match(route.pad) : null;

      if (match) {
        const { status = 200, body } = route.antwoord(match);
        return new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    onbekend.push(`${methode} ${pad}`);
    return new Response(JSON.stringify({ message: "Niet gevonden (nep-API)" }), { status: 404 });
  });

  vi.stubGlobal("fetch", nepFetch);

  return { nepFetch, onbekend, aanroepen };
}
