import { describe, expect, it } from "vitest";

import { bouwOpenApiDocument, vindRoutes } from "./document.js";
import { OpenApiController } from "./openapi.controller.js";
import { alleRoutes } from "./routes.js";

type Operatie = {
  security?: unknown[];
  parameters?: Array<{ name: string; in: string; required: boolean }>;
  requestBody?: unknown;
  responses: Record<string, unknown>;
  "x-rollen"?: string[];
};

const document = bouwOpenApiDocument() as {
  openapi: string;
  paths: Record<string, Record<string, Operatie>>;
  components: { schemas: Record<string, unknown> };
};

const operatie = (pad: string, methode: string) => document.paths[`/api/v1${pad}`]?.[methode];

describe("OpenAPI-specificatie", () => {
  it("bevat elke controllerroute precies één keer en niets anders", () => {
    const routes = vindRoutes();
    const operaties = Object.values(document.paths).flatMap((p) => Object.keys(p));

    expect(operaties).toHaveLength(routes.length);
    expect(alleRoutes()).toHaveLength(routes.length);
  });

  it("leest pad, methode, statuscode en rollen uit de controller", () => {
    const voorleggen = operatie("/taken/{id}/beoordeling/voorleggen", "post")!;
    expect(Object.keys(voorleggen.responses)).toEqual(expect.arrayContaining(["201", "400", "401", "403", "404", "409", "412", "428"]));
    expect(voorleggen["x-rollen"]).toEqual(["recordmanager"]);
    expect(voorleggen.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "If-Match", in: "header", required: true }),
        expect.objectContaining({ name: "id", in: "path", required: true }),
      ])
    );

    expect(Object.keys(operatie("/beheer/stekkers/{id}", "delete")!.responses)).toContain("204");
    expect(Object.keys(operatie("/taken/{id}/archiveren", "post")!.responses)).toContain("202");
  });

  it("neemt invoer over uit de zod-schema's van de controller", () => {
    const kandidaten = operatie("/taken/{id}/kandidaten", "get")!;
    const namen = kandidaten.parameters!.map((p) => p.name);
    expect(namen).toEqual(expect.arrayContaining(["id", "offset", "limit", "zoek", "status"]));

    expect(operatie("/taakdefinities", "post")!.requestBody).toBeDefined();
    expect(operatie("/taken", "get")!.parameters).toEqual([expect.objectContaining({ name: "scope", in: "query" })]);
  });

  it("verwijst naar benoemde antwoordschema's als componenten", () => {
    const taak = operatie("/taken/{id}", "get")!.responses["200"] as { content: { "application/json": { schema: unknown } } };
    expect(taak.content["application/json"].schema).toEqual({ $ref: "#/components/schemas/ApiTaakinstantie" });
    expect(document.components.schemas).toHaveProperty("ApiTaakinstantie");

    const tekst = JSON.stringify(document);
    const verwijzingen = [...tekst.matchAll(/#\/components\/schemas\/(\w+)/g)].map((m) => m[1]!);
    expect(verwijzingen.filter((id) => !(id in document.components.schemas))).toEqual([]);
    expect(tekst).not.toContain("$defs");
  });

  it("markeert alleen health en de specificatie zelf als publiek", () => {
    const publiek = Object.entries(document.paths)
      .flatMap(([pad, ops]) => Object.entries(ops).map(([m, op]) => ({ route: `${m.toUpperCase()} ${pad}`, op })))
      .filter(({ op }) => Array.isArray(op.security) && op.security.length === 0)
      .map(({ route }) => route);

    expect(publiek.sort()).toEqual(["GET /api/v1/health", "GET /api/v1/health/ready", "GET /api/v1/openapi.json"]);
  });

  it("levert het document via de controller", () => {
    expect(new OpenApiController().specificatie()).toMatchObject({ openapi: "3.1.0", info: { version: "1.0.0" } });
  });
});
