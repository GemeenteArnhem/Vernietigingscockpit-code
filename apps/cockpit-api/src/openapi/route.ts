// Bouwstenen van het OpenAPI-register (NeRDS-leidraad H4/H9, API Design Rules).
//
// Pad, methode, statuscode, rollen en invoer (params, query, body) leest de generator uit de
// Nest-metadata van de controller zelf. Het register vult alleen aan wat daar niet in staat:
// een samenvatting en het schema van het antwoord. De compiler controleert dat dat schema past
// bij wat de controllermethode echt teruggeeft; een afwijking is een typefout.
import type { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Klasse<C> = abstract new (...args: any[]) => C;

type MethodeNaam<C> = {
  [K in keyof C]: C[K] extends (...args: never[]) => unknown ? K : never;
}[keyof C] &
  string;

type Uitkomst<C, K extends keyof C> = C[K] extends (...args: never[]) => infer R ? Awaited<R> : never;

export type JsonAntwoord<S extends z.ZodType = z.ZodType> = { soort: "json"; schema: S };
export type LeegAntwoord = { soort: "leeg" };
export type BestandAntwoord = { soort: "bestand"; contentType: string };
export type AntwoordDef = JsonAntwoord | LeegAntwoord | BestandAntwoord;

export const json = <S extends z.ZodType>(schema: S): JsonAntwoord<S> => ({ soort: "json", schema });
export const leeg = (): LeegAntwoord => ({ soort: "leeg" });
export const bestand = (contentType: string): BestandAntwoord => ({ soort: "bestand", contentType });

// Geeft `unknown` (geen extra eis) als het antwoord past, anders een verplicht veld met de
// uitleg, zodat de compiler de route aanwijst.
type Controle<R, A> =
  A extends JsonAntwoord<infer S>
    ? [R] extends [z.output<S>]
      ? unknown
      : { antwoordPastNietBijReturntype: R }
    : A extends LeegAntwoord
      ? [R] extends [void | undefined]
        ? unknown
        : { leegAntwoordMaarReturntypeIs: R }
      : unknown;

export type RouteDef = {
  controller: Klasse<unknown>;
  methode: string;
  tag: string;
  samenvatting: string;
  beschrijving?: string;
  antwoord: AntwoordDef;
};

export function route<C, K extends MethodeNaam<C>, A extends AntwoordDef>(
  controller: Klasse<C>,
  methode: K,
  def: { tag: string; samenvatting: string; beschrijving?: string; antwoord: A } & Controle<Uitkomst<C, K>, A>
): RouteDef {
  return {
    controller,
    methode,
    tag: def.tag,
    samenvatting: def.samenvatting,
    ...(def.beschrijving ? { beschrijving: def.beschrijving } : {}),
    antwoord: def.antwoord,
  };
}
