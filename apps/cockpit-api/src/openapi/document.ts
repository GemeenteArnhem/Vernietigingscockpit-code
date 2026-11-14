// Bouwt de OpenAPI 3.1-specificatie van de cockpit-API uit de code (NeRDS-leidraad H4/H9):
// - pad, methode, statuscode, rollen, publiek, If-Match en invoer uit de Nest-metadata van
//   de controllers (ZodPipe-schema's voor body en query, UUID voor id's);
// - antwoorden uit het register (routes.ts), met de schema's uit @vernietigingscockpit/api-contract.
// Een controllermethode met een route die niet in het register staat, of andersom, is een fout.
import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { apiAntwoordRegister } from "@vernietigingscockpit/api-contract";
import { z } from "zod";

import { IS_PUBLIC_KEY } from "../modules/auth/public.decorator.js";
import { ANY_AUTHENTICATED_KEY, ROLES_KEY } from "../modules/auth/roles.decorator.js";
import { UUID, ZodPipe } from "../shared/http/validatie.js";
import type { AntwoordDef, Klasse, RouteDef } from "./route.js";
import { alleControllers, alleRoutes } from "./routes.js";

// Metadata-sleutels van @nestjs/common (constants.js); niet publiek geëxporteerd.
const PATH_METADATA = "path";
const METHOD_METADATA = "method";
const ROUTE_ARGS_METADATA = "__routeArguments__";
const HTTP_CODE_METADATA = "__httpCode__";
// RouteParamtypes van @nestjs/common.
const PARAM_SOORT = { BODY: 3, QUERY: 4, PARAM: 5, HEADERS: 6 } as const;

export const API_PREFIX = "/api/v1";
// Major versie gelijk aan het pad (/api/v1).
export const API_VERSIE = "1.0.0";

const COMPONENT = (id: string) => `#/components/schemas/${id}`;

type JsonSchema = Record<string, unknown>;
type RouteArg = { index: number; data?: string; pipes?: unknown[] };

export type GevondenRoute = {
  controller: Klasse<unknown>;
  methode: string;
  httpMethode: string;
  pad: string;
};

const HTTP_METHODEN: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.GET]: "get",
  [RequestMethod.POST]: "post",
  [RequestMethod.PUT]: "put",
  [RequestMethod.DELETE]: "delete",
  [RequestMethod.PATCH]: "patch",
};

function padDelen(...delen: Array<string | undefined>) {
  const pad = delen
    .flatMap((deel) => (deel ?? "").split("/"))
    .filter(Boolean)
    .join("/");
  return `/${pad}`;
}

// Alle routes zoals Nest ze registreert, uit de decorators van de controllers.
export function vindRoutes(controllers: Array<Klasse<unknown>> = alleControllers()): GevondenRoute[] {
  const routes: GevondenRoute[] = [];

  for (const controller of controllers) {
    const basis = Reflect.getMetadata(PATH_METADATA, controller) as string | undefined;
    const prototype = controller.prototype as Record<string, unknown>;

    for (const methode of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[methode];
      if (methode === "constructor" || typeof handler !== "function") {
        continue;
      }
      const httpMethode = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (httpMethode === undefined) {
        continue;
      }
      const naam = HTTP_METHODEN[httpMethode];
      if (!naam) {
        throw new Error(`${controller.name}.${methode}: HTTP-methode ${httpMethode} wordt niet ondersteund.`);
      }
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      routes.push({ controller, methode, httpMethode: naam, pad: padDelen(API_PREFIX, basis, sub === "/" ? "" : sub) });
    }
  }

  return routes;
}

// Zet een zod-schema om naar JSON Schema; benoemde antwoordschema's worden verwijzingen naar
// components/schemas.
function naarJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const uitkomst = z.toJSONSchema(schema, {
    metadata: apiAntwoordRegister,
    io,
    unrepresentable: "any",
  }) as JsonSchema;
  const { $schema: _schema, $defs: _defs, $id: _id, ...rest } = uitkomst;
  void _schema;
  void _defs;
  void _id;
  return JSON.parse(JSON.stringify(rest).replaceAll('"#/$defs/', '"#/components/schemas/')) as JsonSchema;
}

function componenten(): Record<string, JsonSchema> {
  const { schemas } = z.toJSONSchema(apiAntwoordRegister, { uri: COMPONENT, io: "output", unrepresentable: "any" }) as {
    schemas: Record<string, JsonSchema>;
  };
  return Object.fromEntries(
    Object.entries(schemas)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, schema]) => {
        const { $schema: _schema, $id: _id, ...rest } = schema;
        void _schema;
        void _id;
        return [id, rest];
      })
  );
}

function zodSchemaVan(pipes: unknown[] | undefined): z.ZodType | undefined {
  const pipe = pipes?.find((p): p is ZodPipe<z.ZodType> => p instanceof ZodPipe);
  return pipe?.schema;
}

const FOUT_SCHEMA: JsonSchema = {
  type: "object",
  description: "Foutmelding van de API. Bij ongeldige invoer (400) staan de velden in `fouten`.",
  properties: {
    statusCode: { type: "integer" },
    error: { type: "string" },
    message: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
    fouten: {
      type: "array",
      items: { type: "object", properties: { veld: { type: "string" }, melding: { type: "string" } }, required: ["veld", "melding"] },
    },
  },
  required: ["statusCode", "message"],
};

const fout = (beschrijving: string) => ({
  description: beschrijving,
  content: { "application/json": { schema: { $ref: COMPONENT("Fout") } } },
});

function antwoordObject(antwoord: AntwoordDef, status: number) {
  switch (antwoord.soort) {
    case "leeg":
      return { description: "Gelukt, zonder inhoud." };
    case "bestand":
      return {
        description: "Het bestand.",
        content: { [antwoord.contentType]: { schema: { type: "string", contentMediaType: antwoord.contentType.split(";")[0] } } },
      };
    case "json":
      return {
        description: status === 202 ? "Geaccepteerd; wordt op de achtergrond uitgevoerd." : "Gelukt.",
        content: { "application/json": { schema: naarJsonSchema(antwoord.schema, "output") } },
      };
  }
}

function operatie(gevonden: GevondenRoute, def: RouteDef) {
  const { controller, methode } = gevonden;
  const handler = (controller.prototype as Record<string, unknown>)[methode] as object;
  const lees = <T>(sleutel: string) =>
    (Reflect.getMetadata(sleutel, handler) as T | undefined) ?? (Reflect.getMetadata(sleutel, controller) as T | undefined);

  const publiek = lees<boolean>(IS_PUBLIC_KEY) === true;
  const rollen = lees<string[]>(ROLES_KEY) ?? [];
  const iedereen = lees<boolean>(ANY_AUTHENTICATED_KEY) === true;
  const standaardStatus = gevonden.httpMethode === "post" ? 201 : def.antwoord.soort === "leeg" ? 204 : 200;
  const status = (Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined) ?? standaardStatus;

  const args = Object.entries(
    (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, methode) as Record<string, RouteArg> | undefined) ?? {}
  ).map(([sleutel, arg]) => ({ soort: Number(sleutel.split(":")[0]), ...arg }));

  const parameters: JsonSchema[] = [];
  let requestBody: JsonSchema | undefined;
  let ifMatch = false;

  for (const arg of args) {
    if (arg.soort === PARAM_SOORT.PARAM && arg.data) {
      const uuid = arg.pipes?.includes(UUID);
      parameters.push({
        name: arg.data,
        in: "path",
        required: true,
        schema: uuid ? { type: "string", format: "uuid" } : { type: "string" },
      });
    } else if (arg.soort === PARAM_SOORT.QUERY) {
      const schema = zodSchemaVan(arg.pipes);
      const json = schema ? naarJsonSchema(schema, "input") : { type: "string" };
      if (arg.data) {
        parameters.push({ name: arg.data, in: "query", required: false, schema: json });
      } else {
        // Hele query als object: elk veld een eigen parameter.
        const eigenschappen = (json.properties ?? {}) as Record<string, JsonSchema>;
        const verplicht = new Set((json.required as string[] | undefined) ?? []);
        for (const [naam, veld] of Object.entries(eigenschappen)) {
          parameters.push({ name: naam, in: "query", required: verplicht.has(naam) && veld.default === undefined, schema: veld });
        }
      }
    } else if (arg.soort === PARAM_SOORT.BODY) {
      const schema = zodSchemaVan(arg.pipes);
      requestBody = {
        required: true,
        content: { "application/json": { schema: schema ? naarJsonSchema(schema, "input") : {} } },
      };
    } else if (arg.soort === PARAM_SOORT.HEADERS && arg.data?.toLowerCase() === "if-match") {
      ifMatch = true;
      parameters.push({
        name: "If-Match",
        in: "header",
        required: true,
        description: "ETag van de versie waarop de wijziging is gebaseerd (bijv. W/\"3\").",
        schema: { type: "string" },
      });
    }
  }

  const responses: Record<string, unknown> = { [String(status)]: antwoordObject(def.antwoord, status) };
  if (parameters.some((p) => p.in !== "header") || requestBody) {
    responses["400"] = fout("Ongeldige invoer.");
  }
  if (!publiek) {
    responses["401"] = fout("Niet ingelogd of token verlopen.");
    responses["403"] = fout("Geen toegang met deze rol.");
  }
  if (parameters.some((p) => p.in === "path")) {
    responses["404"] = fout("Niet gevonden, of geen toegang tot dit object.");
  }
  if (ifMatch) {
    responses["409"] = fout("Conflict met de huidige toestand.");
    responses["412"] = fout("De versie in If-Match is niet (meer) de actuele versie.");
    responses["428"] = fout("If-Match ontbreekt.");
  }

  const rolTekst = publiek ? "Publiek." : iedereen ? "Elke ingelogde gebruiker." : `Rollen: ${rollen.join(", ")}.`;

  return {
    tags: [def.tag],
    summary: def.samenvatting,
    description: [def.beschrijving, rolTekst].filter(Boolean).join("\n\n"),
    operationId: `${controller.name.replace(/Controller$/, "")}_${methode}`,
    ...(publiek ? { security: [] } : {}),
    ...(rollen.length > 0 ? { "x-rollen": rollen } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
}

export function bouwOpenApiDocument(): Record<string, unknown> {
  const gevonden = vindRoutes();
  const register = alleRoutes();
  const sleutel = (controller: Klasse<unknown>, methode: string) => `${controller.name}.${methode}`;
  const perSleutel = new Map(register.map((r) => [sleutel(r.controller, r.methode), r]));

  const ontbrekend = gevonden.filter((g) => !perSleutel.has(sleutel(g.controller, g.methode))).map((g) => sleutel(g.controller, g.methode));
  const overbodig = register
    .filter((r) => !gevonden.some((g) => sleutel(g.controller, g.methode) === sleutel(r.controller, r.methode)))
    .map((r) => sleutel(r.controller, r.methode));
  if (ontbrekend.length > 0 || overbodig.length > 0) {
    throw new Error(
      `OpenAPI-register (src/openapi/routes.ts) klopt niet met de controllers. Ontbreekt: ${ontbrekend.join(", ") || "-"}. Geen route: ${overbodig.join(", ") || "-"}.`
    );
  }

  const paths: Record<string, Record<string, unknown>> = {};
  for (const g of gevonden) {
    const oasPad = g.pad.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    paths[oasPad] ??= {};
    paths[oasPad][g.httpMethode] = operatie(g, perSleutel.get(sleutel(g.controller, g.methode))!);
  }

  const tags = [...new Set(register.map((r) => r.tag))].map((name) => ({ name }));

  return {
    openapi: "3.1.0",
    info: {
      title: "Vernietigingscockpit API",
      version: API_VERSIE,
      description:
        "API van de Vernietigingscockpit, gebruikt door de web-app. Gegenereerd uit de code (apps/cockpit-api/src/openapi); niet met de hand bewerken.",
      contact: { name: "Gemeente Arnhem", url: "https://github.com/GemeenteArnhem/Vernietigingscockpit-code" },
      license: { name: "EUPL-1.2", identifier: "EUPL-1.2" },
    },
    servers: [{ url: "/", description: "Dezelfde host als de web-app" }],
    security: [{ oidc: [] }],
    tags,
    paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
    components: {
      securitySchemes: {
        oidc: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Access token van de OpenID Connect-provider (Keycloak)." },
      },
      schemas: { ...componenten(), Fout: FOUT_SCHEMA },
    },
  };
}
