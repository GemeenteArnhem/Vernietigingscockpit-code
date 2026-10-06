// Types van de Stekker-API (CC-19), afgeleid uit de gegenereerde module. Alleen types: de
// cockpit-API heeft een eigen client (OAuth2, time-outs, strikte toetsing) die deze types
// gebruikt, zodat een contractwijziging direct tot compileerfouten leidt.
import type { components, operations, paths } from "./stekker-api.js";

export type { components, operations, paths };

type Schemas = components["schemas"];

export type SelectieStart = Schemas["SelectieStart"];
export type Selectie = Schemas["Selectie"];
export type SelectieStatus = Schemas["SelectieStatus"];
export type Vernietigingskandidaat = Schemas["Vernietigingskandidaat"];
export type VernietigingskandidatenPagina = Schemas["VernietigingskandidatenPagina"];
export type VernietigingStart = Schemas["VernietigingStart"];
export type VernietigingVrijgave = Schemas["VernietigingVrijgave"];
export type Vernietigingsuitvoering = Schemas["Vernietigingsuitvoering"];
export type VernietigingStatus = Schemas["VernietigingStatus"];
export type VernietigingBatch = Schemas["VernietigingBatch"];
export type TeVernietigenObject = Schemas["TeVernietigenObject"];
export type BatchResultaat = Schemas["BatchResultaat"];
export type Uitvoeringsresultaat = Schemas["Uitvoeringsresultaat"];
export type UitvoeringsresultaatWaarde = Schemas["UitvoeringsresultaatWaarde"];
export type Waardering = Schemas["Waardering"];
export type Fout = Schemas["Fout"];
