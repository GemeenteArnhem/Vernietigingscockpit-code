// Antwoordtypes van de cockpit-API (CC-19). De API geeft ze op als returntype van de
// services, de web-app gebruikt ze bij het ophalen; zo merkt de compiler het als de twee
// uit elkaar lopen. Datums zijn ISO-strings.

import type { AppRole } from "./rollen.js";

export type ApiMedewerker = {
  id: string;
  naam: string;
  email?: string;
  rollen?: string[];
};

export type ApiStekker = {
  id: string;
  naam: string;
  omschrijving?: string | null;
};

export type ApiVerantwoordelijken = {
  recordmanager: ApiMedewerker;
  proceseigenaar: ApiMedewerker;
  archivaris: ApiMedewerker;
};

// Naam en e-mail van een verantwoordelijke, zoals de taakstappen die tonen.
export type ApiPersoon = {
  naam: string;
  email?: string | null;
};

export type ApiTellingen = {
  totaalKandidaten: number;
  totaalObjecten: number;
  totaalBetrokkenen: number;
};

export type ApiTaakinstantie = {
  id: string;
  naam: string;
  status: string;
  stapSinds: string;
  peildatum?: string | null;
  // Geplande startdatum van een terugkerende taak; ervoor toont de UI 'Gepland'.
  geplandOp?: string | null;
  gestartOp?: string | null;
  taakdefinitie?: ApiTaakdefinitieSamenvatting;
  verantwoordelijken: ApiVerantwoordelijken;
  tellingen: ApiTellingen;
  toegestaneActies?: string[];
};

export type ApiTaakdefinitieSamenvatting = {
  id: string;
  naam: string;
  categorie: string;
  frequentie: string;
};

export type ApiTaakdefinitie = {
  id: string;
  naam: string;
  omschrijving?: string | null;
  categorie: string;
  frequentie: string;
  verantwoordelijken: ApiVerantwoordelijken;
  stekkers: ApiStekker[];
  instanties?: ApiTaakinstantie[];
  toegestaneActies?: string[];
};

export type ApiMe = {
  id: string;
  username?: string;
  name?: string;
  email?: string | null;
  roles: AppRole[];
  actions: string[];
  medewerkerId?: string | null;
  medewerker?: {
    id: string;
    naam: string;
    email: string;
    afdeling: { naam: string; code: string } | null;
  } | null;
  laatstGezien?: string;
};

// --- stamgegevens en stekkers ------------------------------------------------------------

export type ApiStamgegevensMedewerker = {
  id: string;
  naam: string;
  email: string;
  rollen: string[];
  afdeling?: {
    naam: string;
    code: string;
  } | null;
};

export type ApiStekkerOptie = {
  id: string;
  naam: string;
  omschrijving?: string | null;
  actief: boolean;
  laatsteConfiguratie?: {
    versie: number;
    baseUrl: string;
    authType: string;
    verwachteApiMajor: number;
  } | null;
};

// --- stekkerbeheer ----------------------------------------------------------------------

export type ApiStekkerConfiguratie = {
  versie: number;
  baseUrl: string;
  authType: string;
  tokenUrl: string | null;
  clientId: string | null;
  // Het secret zelf komt nooit uit de API; alleen of er een is.
  secretIngesteld: boolean;
  secretRef: string | null;
  scopes: string[];
  verwachteApiMajor: number;
  timeouts: Record<string, unknown>;
  parameters: Record<string, unknown>;
  aangemaaktDoor: string;
  aangemaaktOp: string;
};

export type ApiStekkerBeheer = {
  id: string;
  naam: string;
  omschrijving: string | null;
  actief: boolean;
  // Waar de stekker in gebruik is; verwijderen kan alleen als beide 0 zijn.
  gebruik: { taakdefinities: number; selecties: number };
  configuratie: ApiStekkerConfiguratie | null;
  versies: Array<{ versie: number; aangemaaktDoor: string; aangemaaktOp: string }>;
  toegestaneActies: string[];
};

// --- selectie ----------------------------------------------------------------------------

export type ApiSelectieStekker = {
  stekker: {
    id: string;
    naam: string;
    omschrijving?: string | null;
    actief: boolean;
  };
  configuratie?: {
    id: string;
    versie: number;
    baseUrl: string;
    verwachteApiMajor: number;
  } | null;
  selectie?: {
    id: string;
    externSelectieId?: string | null;
    status: string;
    peildatum?: string | null;
    selectietijdstip?: string | null;
    totaalKandidaten: number;
    totaalObjecten: number;
    totaalBetrokkenen: number;
    geimporteerd: number;
    fout?: string | null;
  } | null;
};

export type ApiTaakSelectie = {
  taak: {
    id: string;
    naam: string;
    status: string;
    peildatum?: string | null;
    taakdefinitie: {
      id: string;
      naam: string;
    };
  };
  stekkers: ApiSelectieStekker[];
};

export type ApiSelectieGestart = ApiTaakSelectie & {
  // Id's van de selecties die deze aanvraag heeft gemaakt.
  aangemaakteSelecties: string[];
};

// --- kandidatenlijst (CC-10) -------------------------------------------------------------

export type ApiTaakContext = {
  id: string;
  naam: string;
  status: string;
  stapSinds: string;
  // Taakversie voor If-Match bij statuswijzigingen.
  versie: number;
  verantwoordelijken: {
    recordmanager: ApiPersoon;
    proceseigenaar: ApiPersoon;
    archivaris: ApiPersoon;
  };
};

export type ApiKandidaat = {
  id: string;
  volgnummer: number;
  kandidaatId: string;
  bronId: string;
  bronIdNaam?: string | null;
  omschrijving: string;
  classificatiesleutel?: string | null;
  selectielijst?: string | null;
  grondslag?: string | null;
  bewaartermijn?: string | null;
  begindatum?: string | null;
  einddatum?: string | null;
  vernietigingsdatum?: string | null;
  aantalObjecten: number;
  aantalBetrokkenen: number;
  beoordeling: string;
  uitsluitReden?: string | null;
  toelichting?: string | null;
  stekker: {
    naam: string;
  };
};

export type ApiKandidatenPagina = {
  taak: ApiTaakContext;
  // Deze pagina, plus tellingen en filterkeuzes over de hele lijst.
  pagina: { offset: number; limit: number; totaal: number };
  tellingen: { totaal: number; opgenomen: number; akkoord: number; uitgesloten: number; retour: number };
  facetten: { status: string[]; selectielijst: string[]; bewaartermijn: string[]; stekker: string[] };
  kandidaten: ApiKandidaat[];
};

export type ApiKandidaatIds = { ids: string[] };

export type ApiGedeeld<T> = { waarde: T | null; verschillend: boolean };

export type ApiSelectieSamenvatting = {
  aantal: number;
  aantalObjecten: number;
  aantalBetrokkenen: number;
  code: ApiGedeeld<string>;
  selectielijst: ApiGedeeld<string>;
  grondslag: ApiGedeeld<string>;
  bewaartermijn: ApiGedeeld<string>;
  stekker: ApiGedeeld<string>;
  periode: ApiGedeeld<[string | null, string | null]>;
  vernietigingsdatum: { van: string | null; tot: string | null };
  volgnummer: { van: number | null; tot: number | null };
  statussen: string[];
};

export type ApiBijgewerkt = { bijgewerkt: number };

// --- beoordeling, accordering en statuswijzigingen ---------------------------------------

export type ApiKandidaatBeoordeling = {
  id: string;
  beoordeling: string;
  uitsluitReden?: string | null;
  toelichting?: string | null;
  versie: number;
};

export type ApiKandidaatAccordering = {
  id: string;
  beoordeling: string;
  toelichting?: string | null;
  versie: number;
};

export type ApiTaakStatus = {
  id: string;
  status: string;
  stapSinds: string;
  versie: number;
};

export type ApiVernietigingsopdracht = ApiTaakStatus & {
  totaalKandidaten: number;
  aantalOpdrachten: number;
};

// --- uitvoering en resultaten ------------------------------------------------------------

export type ApiResultaatTellingen = {
  success: number;
  failed: number;
  notFound: number;
  skipped: number;
  changed: number;
};

export type ApiUitvoeringStekker = {
  id: string;
  naam: string;
  versie?: string | null;
  stekkerStatus: string;
  selectieId: string;
  externSelectieId?: string | null;
  externVernietigingId?: string | null;
  vernietigingStatus?: string | null;
  vernietigingGestartOp?: string | null;
  vernietigingAfgerondOp?: string | null;
  aantalKandidaten: number;
  batchGrootte?: number;
  aantalObjecten: number;
  fout?: string | null;
  resultaatTellingen: ApiResultaatTellingen;
  toegestaneActies?: string[];
};

export type ApiUitvoering = {
  // toegestaneActies: welke taakacties de API toestaat, bijv. vernietiging.opdracht_geven.
  taak: ApiTaakContext & { toegestaneActies?: string[] };
  stekkers: ApiUitvoeringStekker[];
};

export type ApiVernietigingsresultaat = {
  id: string;
  kandidaatId: string;
  bronId: string;
  bronIdNaam?: string | null;
  omschrijving: string;
  classificatiesleutel?: string | null;
  selectielijst?: string | null;
  grondslag?: string | null;
  bewaartermijn?: string | null;
  begindatum?: string | null;
  einddatum?: string | null;
  vernietigingsdatum?: string | null;
  aantalObjecten: number;
  aantalBetrokkenen: number;
  // Leeg zolang de stekker nog geen resultaat heeft gemeld (CC-8).
  vernietigingsstatus: string | null;
  foutcode?: string | null;
  foutmelding?: string | null;
  bronstatus?: string | null;
  logReference?: string | null;
  correlatieId?: string | null;
  stekker: {
    naam: string;
  };
};

export type ApiArchivering = {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  adapter: string;
  locatie: string | null;
  manifestSha256: string | null;
  fout: string | null;
  aangevraagdOp: string;
  afgerondOp: string | null;
};

export type ApiArchiveringStand = { taakStatus: string; archivering: ApiArchivering | null };

export type ApiVernietigingsresultaten = {
  // Archivering (CC-18): laatste poging en of de recordmanager nu kan archiveren.
  taak: ApiTaakContext & { toegestaneActies?: string[]; archivering?: ApiArchivering | null };
  resultaten: ApiVernietigingsresultaat[];
};

// --- verklaring (CC-17) ------------------------------------------------------------------

// Tijdens de uitvoering is er nog niets; daarna (tot de worker klaar is) een voorbeeld
// met `beschikbaar: false`, en vanaf de opgeslagen versie `beschikbaar: true`.
export type ApiVerklaringNietBeschikbaar = { beschikbaar: false; status: string };

export type ApiVerklaringTaak = {
  id: string;
  naam: string;
  status: string;
  stapSinds: string;
  taakdefinitie: string;
  peildatum: string | null;
  rondes: number;
  afgerondOp: string | null;
  verantwoordelijken: {
    recordmanager: ApiPersoon;
    proceseigenaar: ApiPersoon;
    archivaris: ApiPersoon;
  };
};

export type ApiVernietigingsverklaring = {
  id?: string;
  beschikbaar: boolean;
  taak: ApiVerklaringTaak;
  versie: number;
  status: string;
  gegenereerdOp: string;
  bijlage: {
    bestandsnaam: string;
    contentType: string;
    aantalRegels: number;
    sha256: string;
  };
  tellingen: ApiResultaatTellingen & {
    aantalObjecten: number;
    aantalBetrokkenen: number;
  };
};

export type ApiVerklaring = ApiVernietigingsverklaring | ApiVerklaringNietBeschikbaar;
