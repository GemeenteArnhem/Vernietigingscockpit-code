// Types van de Stekker-API v2 (CC-19, ADR-0005), afgeleid uit de gegenereerde module. Alleen
// types: de cockpit-API heeft een eigen client (OAuth2, time-outs, strikte toetsing) die deze
// types gebruikt, zodat een contractwijziging direct tot compileerfouten leidt.
import type { components, operations, paths } from "./stekker-api.js";

export type { components, operations, paths };

type Schemas = components["schemas"];

// MDTO-gegevensgroepen (MDTO-XML 1.0.1).
export type IdentificatieGegevens = Schemas["identificatieGegevens"];
export type VerwijzingGegevens = Schemas["verwijzingGegevens"];
export type BegripGegevens = Schemas["begripGegevens"];
export type DekkingInTijdGegevens = Schemas["dekkingInTijdGegevens"];
export type GerelateerdInformatieobjectGegevens = Schemas["gerelateerdInformatieobjectGegevens"];
export type Aggregatieniveau = Schemas["Aggregatieniveau"];
export type Waardering = Schemas["Waardering"];
export type Bewaartermijn = Schemas["Bewaartermijn"];
export type InformatiecategorieAfwijking = Schemas["InformatiecategorieAfwijking"];
export type VernietigingsEvent = Schemas["VernietigingsEvent"];

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
export type TeVernietigenKandidaat = Schemas["TeVernietigenKandidaat"];
export type BatchResultaat = Schemas["BatchResultaat"];
export type Uitvoeringsresultaat = Schemas["Uitvoeringsresultaat"];
export type UitvoeringsresultaatWaarde = Schemas["UitvoeringsresultaatWaarde"];
export type Fout = Schemas["Fout"];
