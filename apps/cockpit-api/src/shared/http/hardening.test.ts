import { BadRequestException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { RolesGuard } from "../../modules/auth/roles.guard.js";
import { ANY_AUTHENTICATED_KEY, ROLES_KEY } from "../../modules/auth/roles.decorator.js";
import { IS_PUBLIC_KEY } from "../../modules/auth/public.decorator.js";
import { rateLimitSleutel } from "./rate-limit.js";
import { auditlogQuerySchema, kandidaatBeoordelingSchema, startSelectieSchema, taakdefinitieSchema } from "@vernietigingscockpit/api-contract";
import { UUID, ZodPipe } from "./validatie.js";

function context(metadata: Record<string, unknown>, user?: { roles: string[] }): ExecutionContext {
  const handler = () => undefined;
  for (const [sleutel, waarde] of Object.entries(metadata)) {
    Reflect.defineMetadata(sleutel, waarde, handler);
  }
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard: default-deny", () => {
  const guard = new RolesGuard(new Reflector());

  it("weigert een endpoint zonder @Roles, @AnyAuthenticated of @Public", () => {
    expect(guard.canActivate(context({}, { roles: ["recordmanager"] }))).toBe(false);
  });

  it("staat @Public en @AnyAuthenticated (met gebruiker) toe", () => {
    expect(guard.canActivate(context({ [IS_PUBLIC_KEY]: true }))).toBe(true);
    expect(guard.canActivate(context({ [ANY_AUTHENTICATED_KEY]: true }, { roles: [] }))).toBe(true);
    expect(guard.canActivate(context({ [ANY_AUTHENTICATED_KEY]: true }))).toBe(false);
  });

  it("controleert de rollen bij @Roles", () => {
    expect(guard.canActivate(context({ [ROLES_KEY]: ["archivaris"] }, { roles: ["recordmanager"] }))).toBe(false);
    expect(guard.canActivate(context({ [ROLES_KEY]: ["archivaris"] }, { roles: ["archivaris"] }))).toBe(true);
  });
});

describe("rate limit", () => {
  it("telt per gebruiker (sub), anders per IP", () => {
    expect(rateLimitSleutel({ user: { sub: "abc" }, ip: "10.0.0.1" })).toBe("gebruiker:abc");
    expect(rateLimitSleutel({ ip: "10.0.0.1" })).toBe("ip:10.0.0.1");
  });
});

describe("invoervalidatie", () => {
  const ongeldig = (schema: z.ZodType, waarde: unknown) => () => new ZodPipe(schema).transform(waarde);

  it("geeft 400 met de velden bij een ongeldige body", () => {
    try {
      new ZodPipe(kandidaatBeoordelingSchema).transform({ beoordeling: "MISSCHIEN", toelichting: "x".repeat(3000) });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const fouten = ((error as BadRequestException).getResponse() as { fouten: Array<{ veld: string }> }).fouten;
      expect(fouten.map((fout) => fout.veld).sort()).toEqual(["beoordeling", "toelichting"]);
    }
  });

  it("accepteert geldige invoer en vult standaardwaarden in", () => {
    expect(new ZodPipe(startSelectieSchema).transform(undefined)).toEqual({});
    expect(new ZodPipe(startSelectieSchema).transform({ peildatum: "2026-01-01" })).toEqual({ peildatum: "2026-01-01" });
    expect(new ZodPipe(auditlogQuerySchema).transform({ pagina: "2" })).toEqual({ pagina: 2, perPagina: 50 });
  });

  it("weigert onzin in datums, enums en id's", () => {
    expect(ongeldig(startSelectieSchema, { peildatum: "2026-13-45" })).toThrow(BadRequestException);
    expect(ongeldig(startSelectieSchema, { stekkerId: "geen-uuid" })).toThrow(BadRequestException);
    expect(ongeldig(auditlogQuerySchema, { perPagina: "1000" })).toThrow(BadRequestException);
    expect(
      ongeldig(taakdefinitieSchema, {
        naam: "x",
        categorie: "y",
        frequentie: "dagelijks",
        recordmanagerId: "a",
        proceseigenaarId: "b",
        archivarisId: "c",
      })
    ).toThrow(BadRequestException);
  });

  it("geeft 400 bij een id dat geen UUID is, en accepteert elke UUID-vorm", () => {
    expect(() => UUID.transform("geen-uuid")).toThrow(BadRequestException);
    expect(UUID.transform("1b4e28ba-2fa1-11d2-883f-0016d3cca427")).toBe("1b4e28ba-2fa1-11d2-883f-0016d3cca427");
    // Ook id's zonder geldig RFC-versiecijfer, zoals de vaste id's uit de seed.
    expect(UUID.transform("00000000-0000-0000-0000-000000000301")).toBe("00000000-0000-0000-0000-000000000301");
    expect(ongeldig(startSelectieSchema, { stekkerId: "00000000-0000-0000-0000-000000000101" })).not.toThrow();
  });
});
