// Testgegevens voor de web-app, getypeerd met het API-contract: loopt de API uit elkaar met
// deze gegevens, dan merkt de compiler dat. Alle namen en adressen zijn verzonnen.
import type {
  ApiKandidaat,
  ApiKandidatenPagina,
  ApiMdtoKandidaat,
  ApiMe,
  ApiSelectieSamenvatting,
  ApiStamgegevensMedewerker,
  ApiStekkerBeheer,
  ApiStekkerOptie,
  ApiTaakContext,
  ApiTaakdefinitie,
  ApiTaakinstantie,
  ApiTaakSelectie,
  ApiUitvoering,
  ApiVernietigingsresultaten,
  ApiVerklaring,
  ApiArchiveringStand,
} from "@vernietigingscockpit/api-contract";

const NU = "2026-11-01T09:00:00.000Z";

const recordmanager = { id: "m-1", naam: "Rianne Recordmanager", email: "rm@voorbeeld.test", rollen: ["recordmanager"] };
const proceseigenaar = { id: "m-2", naam: "Pieter Proceseigenaar", email: "pe@voorbeeld.test", rollen: ["proceseigenaar"] };
const archivaris = { id: "m-3", naam: "Anna Archivaris", email: "ar@voorbeeld.test", rollen: ["archivaris"] };

export const me: ApiMe = {
  id: "gebruiker-1",
  name: recordmanager.naam,
  email: recordmanager.email,
  roles: ["recordmanager"],
  actions: [],
  medewerkerId: recordmanager.id,
};

export function taakinstantie(status: string, extra: Partial<ApiTaakinstantie> = {}): ApiTaakinstantie {
  return {
    id: "1",
    naam: "Vernietiging zaken 2026",
    status,
    stapSinds: NU,
    peildatum: "2026-10-01",
    gestartOp: NU,
    taakdefinitie: { id: "1", naam: "Jaarlijkse vernietiging zaken", categorie: "vernietiging", frequentie: "jaarlijks" },
    verantwoordelijken: { recordmanager, proceseigenaar, archivaris },
    tellingen: { totaalKandidaten: 2, totaalObjecten: 5, totaalBetrokkenen: 3 },
    toegestaneActies: [],
    ...extra,
  };
}

export const stekker = { id: "s-1", naam: "Zaaksysteem", omschrijving: "Teststekker" };

export const taakdefinitie: ApiTaakdefinitie = {
  id: "1",
  naam: "Jaarlijkse vernietiging zaken",
  omschrijving: "Vernietiging van zaken waarvan de bewaartermijn is verstreken.",
  categorie: "vernietiging",
  frequentie: "jaarlijks",
  verantwoordelijken: { recordmanager, proceseigenaar, archivaris },
  stekkers: [stekker],
  instanties: [taakinstantie("BEOORDELING")],
  toegestaneActies: [],
};

export const stekkerOpties: ApiStekkerOptie[] = [
  { ...stekker, actief: true, laatsteConfiguratie: { versie: 1, baseUrl: "https://stekker.voorbeeld.test", authType: "oauth2_cc", verwachteApiMajor: 2 } },
];

export const medewerkers: ApiStamgegevensMedewerker[] = [recordmanager, proceseigenaar, archivaris].map((m) => ({
  ...m,
  afdeling: { naam: "Informatiebeheer", code: "IB" },
}));

export const stekkerBeheer: ApiStekkerBeheer = {
  id: stekker.id,
  naam: stekker.naam,
  omschrijving: stekker.omschrijving,
  actief: true,
  gebruik: { taakdefinities: 1, selecties: 1 },
  configuratie: {
    versie: 1,
    baseUrl: "https://stekker.voorbeeld.test",
    authType: "oauth2_cc",
    tokenUrl: "https://idp.voorbeeld.test/token",
    clientId: "cockpit",
    secretIngesteld: true,
    secretRef: "stekker-s-1",
    scopes: ["selectie.read"],
    verwachteApiMajor: 2,
    timeouts: {},
    parameters: {},
    aangemaaktDoor: "Beheerder",
    aangemaaktOp: NU,
  },
  versies: [{ versie: 1, aangemaaktDoor: "Beheerder", aangemaaktOp: NU }],
  toegestaneActies: [],
};

const taakContext: ApiTaakContext = {
  id: "1",
  naam: "Vernietiging zaken 2026",
  status: "BEOORDELING",
  stapSinds: NU,
  versie: 1,
  verantwoordelijken: {
    recordmanager: { naam: recordmanager.naam, email: recordmanager.email },
    proceseigenaar: { naam: proceseigenaar.naam, email: proceseigenaar.email },
    archivaris: { naam: archivaris.naam, email: archivaris.email },
  },
  archiefvormer: { verwijzingNaam: "Gemeente Voorbeeld" },
};

const begrippenlijst = { verwijzingNaam: "Selectielijst gemeenten 2020" };

function mdto(nummer: number): ApiMdtoKandidaat {
  return {
    vernietigingskandidaatId: `vk-${nummer}`,
    identificatie: [{ identificatieKenmerk: `ZAAK-${nummer}`, identificatieBron: "Zaaksysteem" }],
    naam: `Omgevingsvergunning ${nummer}`,
    omschrijving: ["Aanvraag omgevingsvergunning"],
    aggregatieniveau: "Dossier",
    classificatie: [{ begripLabel: "Vergunningverlening", begripCode: "1.1", begripBegrippenlijst: begrippenlijst }],
    dekkingInTijd: [
      {
        dekkingInTijdType: { begripLabel: "Looptijd", begripBegrippenlijst: begrippenlijst },
        dekkingInTijdBegindatum: "2010-01-01",
        dekkingInTijdEinddatum: "2010-06-30",
      },
    ],
    waardering: { begripLabel: "Tijdelijk te bewaren", begripCode: "V", begripBegrippenlijst: begrippenlijst },
    bewaartermijn: {
      termijnTriggerStartLooptijd: null,
      termijnStartdatumLooptijd: "2010-06-30",
      termijnLooptijd: "P10Y",
      termijnEinddatum: "2020-06-30",
    },
    informatiecategorie: { begripLabel: "1.1.1 Vergunning", begripCode: "1.1.1", begripBegrippenlijst: begrippenlijst },
    selectielijst: { code: "SL-2020", naam: "Selectielijst gemeenten 2020", bekend: true },
    informatiecategorieAfwijking: null,
    gerelateerdInformatieobject: null,
    archiefvormer: null,
    activiteit: null,
    aantalObjecten: 2,
    aantalBetrokkenen: 1,
    stekkerToelichting: null,
  };
}

function kandidaat(nummer: number): ApiKandidaat {
  return {
    ...mdto(nummer),
    id: `k-${nummer}`,
    volgnummer: nummer,
    beoordeling: "OPGENOMEN",
    opmerkingen: [],
    stekker: { naam: stekker.naam },
  };
}

export const kandidatenPagina: ApiKandidatenPagina = {
  taak: taakContext,
  pagina: { offset: 0, limit: 50, totaal: 2 },
  tellingen: { totaal: 2, opgenomen: 2, akkoord: 0, uitgesloten: 0, retour: 0 },
  facetten: { status: ["OPGENOMEN"], selectielijst: ["SL-2020"], termijnLooptijd: ["P10Y"], stekker: [stekker.naam] },
  kandidaten: [kandidaat(1), kandidaat(2)],
};

export const samenvatting: ApiSelectieSamenvatting = {
  aantal: 2,
  aantalObjecten: 4,
  aantalBetrokkenen: 2,
  classificatie: { waarde: "1.1", verschillend: false },
  selectielijst: { waarde: { code: "SL-2020", naam: "Selectielijst gemeenten 2020", bekend: true }, verschillend: false },
  informatiecategorie: { waarde: "1.1.1", verschillend: false },
  termijnLooptijd: { waarde: "P10Y", verschillend: false },
  stekker: { waarde: stekker.naam, verschillend: false },
  aggregatieniveau: { waarde: "Dossier", verschillend: false },
  waardering: { waarde: "Tijdelijk te bewaren", verschillend: false },
  dekkingInTijd: { waarde: ["2010-01-01", "2010-06-30"], verschillend: false },
  termijnEinddatum: { van: "2020-06-30", tot: "2020-06-30" },
  volgnummer: { van: 1, tot: 2 },
  statussen: ["OPGENOMEN"],
};

export const selectie: ApiTaakSelectie = {
  taak: { id: "1", naam: taakContext.naam, status: "SELECTIE", peildatum: "2026-10-01", taakdefinitie: { id: "1", naam: taakdefinitie.naam } },
  stekkers: [
    {
      stekker: { ...stekker, actief: true },
      configuratie: { id: "c-1", versie: 1, baseUrl: "https://stekker.voorbeeld.test", verwachteApiMajor: 2 },
      selectie: {
        id: "sel-1",
        status: "GEIMPORTEERD",
        peildatum: "2026-10-01",
        selectietijdstip: NU,
        totaalKandidaten: 2,
        totaalObjecten: 4,
        totaalBetrokkenen: 2,
        geimporteerd: 2,
      },
    },
  ],
};

const tellingenNul = { success: 0, failed: 0, notFound: 0, skipped: 0, changed: 0 };

export const uitvoering: ApiUitvoering = {
  taak: { ...taakContext, status: "UITVOERING", toegestaneActies: [] },
  stekkers: [
    {
      id: stekker.id,
      naam: stekker.naam,
      stekkerStatus: "IDLE",
      selectieId: "sel-1",
      aantalKandidaten: 2,
      aantalObjecten: 4,
      resultaatTellingen: tellingenNul,
      toegestaneActies: [],
    },
  ],
};

export const resultaten: ApiVernietigingsresultaten = {
  taak: { ...taakContext, status: "AFGEROND", toegestaneActies: [], archivering: null },
  resultaten: [
    {
      ...mdto(1),
      id: "r-1",
      resultaat: "SUCCESS",
      eventTijd: NU,
      vernietigingsmethode: "Verwijderd",
      opmerkingen: [],
      stekker: { naam: stekker.naam },
    },
  ],
};

export const verklaring: ApiVerklaring = { beschikbaar: false, status: "UITVOERING" };

export const archivering: ApiArchiveringStand = { taakStatus: "AFGEROND", archivering: null };
