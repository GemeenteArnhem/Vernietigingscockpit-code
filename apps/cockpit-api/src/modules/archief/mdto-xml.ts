// MDTO-XML 1.0.1 (Nationaal Archief) voor het archiefpakket (ADR-0005 §7). Eén document
// beschrijft precies één object: een informatieobject of een bestand. De elementvolgorde
// volgt de XSD (MDTO-XML1.0.1.xsd).

const MDTO_NAMESPACE = "https://www.nationaalarchief.nl/mdto";
const MDTO_SCHEMA_LOCATION = `${MDTO_NAMESPACE} ${MDTO_NAMESPACE}/MDTO-XML1.0.1.xsd`;

export type MdtoIdentificatie = { identificatieKenmerk: string; identificatieBron: string };
export type MdtoVerwijzing = { verwijzingNaam: string; verwijzingIdentificatie?: MdtoIdentificatie };
export type MdtoBegrip = { begripLabel: string; begripCode?: string; begripBegrippenlijst: MdtoVerwijzing };
export type MdtoDekkingInTijd = {
  dekkingInTijdType: MdtoBegrip;
  dekkingInTijdBegindatum: string;
  dekkingInTijdEinddatum?: string;
};
export type MdtoEvent = {
  eventType: MdtoBegrip;
  eventTijd?: string;
  eventVerantwoordelijkeActor?: MdtoVerwijzing;
  eventResultaat?: string;
};
export type MdtoTermijn = {
  termijnTriggerStartLooptijd?: MdtoBegrip | null;
  termijnStartdatumLooptijd?: string | null;
  termijnLooptijd?: string | null;
  termijnEinddatum?: string | null;
};
export type MdtoGerelateerdInformatieobject = {
  gerelateerdInformatieobjectVerwijzing: MdtoVerwijzing;
  gerelateerdInformatieobjectTypeRelatie: MdtoBegrip;
};
export type MdtoBeperkingGebruik = { beperkingGebruikType: MdtoBegrip; beperkingGebruikNadereBeschrijving?: string };

export type MdtoInformatieobject = {
  identificatie: MdtoIdentificatie[];
  naam: string;
  aggregatieniveau?: MdtoBegrip;
  classificatie?: MdtoBegrip[];
  omschrijving?: string[];
  dekkingInTijd?: MdtoDekkingInTijd[];
  event?: MdtoEvent[];
  waardering: MdtoBegrip;
  bewaartermijn?: MdtoTermijn;
  informatiecategorie?: MdtoBegrip;
  isOnderdeelVan?: MdtoVerwijzing[];
  bevatOnderdeel?: MdtoVerwijzing[];
  heeftRepresentatie?: MdtoVerwijzing[];
  gerelateerdInformatieobject?: MdtoGerelateerdInformatieobject[];
  archiefvormer: MdtoVerwijzing[];
  activiteit?: MdtoVerwijzing;
  beperkingGebruik: MdtoBeperkingGebruik[];
};

export type MdtoBestand = {
  identificatie: MdtoIdentificatie[];
  naam: string;
  omvang: number;
  bestandsformaat: MdtoBegrip;
  checksum: { checksumAlgoritme: MdtoBegrip; checksumWaarde: string; checksumDatum: string }[];
  isRepresentatieVan: MdtoVerwijzing;
};

export function informatieobjectXml(io: MdtoInformatieobject) {
  return document("informatieobject", [
    ...io.identificatie.map((item) => identificatie("identificatie", item, 4)),
    element("naam", io.naam, 4),
    ...(io.aggregatieniveau ? [begrip("aggregatieniveau", io.aggregatieniveau, 4)] : []),
    ...(io.classificatie ?? []).map((item) => begrip("classificatie", item, 4)),
    ...(io.omschrijving ?? []).map((tekst) => element("omschrijving", tekst, 4)),
    ...(io.dekkingInTijd ?? []).map((item) => dekkingInTijd(item, 4)),
    ...(io.event ?? []).map((item) => event(item, 4)),
    begrip("waardering", io.waardering, 4),
    ...(io.bewaartermijn ? [termijn("bewaartermijn", io.bewaartermijn, 4)] : []),
    ...(io.informatiecategorie ? [begrip("informatiecategorie", io.informatiecategorie, 4)] : []),
    ...(io.isOnderdeelVan ?? []).map((item) => verwijzing("isOnderdeelVan", item, 4)),
    ...(io.bevatOnderdeel ?? []).map((item) => verwijzing("bevatOnderdeel", item, 4)),
    ...(io.heeftRepresentatie ?? []).map((item) => verwijzing("heeftRepresentatie", item, 4)),
    ...(io.gerelateerdInformatieobject ?? []).map((item) => gerelateerd(item, 4)),
    ...io.archiefvormer.map((item) => verwijzing("archiefvormer", item, 4)),
    ...(io.activiteit ? [verwijzing("activiteit", io.activiteit, 4)] : []),
    ...io.beperkingGebruik.map((item) => beperkingGebruik(item, 4)),
  ]);
}

export function bestandXml(bestand: MdtoBestand) {
  return document("bestand", [
    ...bestand.identificatie.map((item) => identificatie("identificatie", item, 4)),
    element("naam", bestand.naam, 4),
    element("omvang", String(bestand.omvang), 4),
    begrip("bestandsformaat", bestand.bestandsformaat, 4),
    ...bestand.checksum.map((item) =>
      blok("checksum", [
        begrip("checksumAlgoritme", item.checksumAlgoritme, 6),
        element("checksumWaarde", item.checksumWaarde, 6),
        element("checksumDatum", item.checksumDatum, 6),
      ], 4)
    ),
    verwijzing("isRepresentatieVan", bestand.isRepresentatieVan, 4),
  ]);
}

function document(soort: "informatieobject" | "bestand", inhoud: string[]) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<MDTO xmlns="${MDTO_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${MDTO_SCHEMA_LOCATION}">`,
    `  <${soort}>`,
    ...inhoud,
    `  </${soort}>`,
    "</MDTO>",
    "",
  ].join("\n");
}

function identificatie(naam: string, item: MdtoIdentificatie, inspring: number) {
  return blok(naam, [
    element("identificatieKenmerk", item.identificatieKenmerk, inspring + 2),
    element("identificatieBron", item.identificatieBron, inspring + 2),
  ], inspring);
}

function verwijzing(naam: string, item: MdtoVerwijzing, inspring: number) {
  return blok(naam, [
    element("verwijzingNaam", item.verwijzingNaam, inspring + 2),
    ...(item.verwijzingIdentificatie ? [identificatie("verwijzingIdentificatie", item.verwijzingIdentificatie, inspring + 2)] : []),
  ], inspring);
}

function begrip(naam: string, item: MdtoBegrip, inspring: number) {
  return blok(naam, [
    element("begripLabel", item.begripLabel, inspring + 2),
    ...(item.begripCode ? [element("begripCode", item.begripCode, inspring + 2)] : []),
    verwijzing("begripBegrippenlijst", item.begripBegrippenlijst, inspring + 2),
  ], inspring);
}

function dekkingInTijd(item: MdtoDekkingInTijd, inspring: number) {
  return blok("dekkingInTijd", [
    begrip("dekkingInTijdType", item.dekkingInTijdType, inspring + 2),
    element("dekkingInTijdBegindatum", item.dekkingInTijdBegindatum, inspring + 2),
    ...(item.dekkingInTijdEinddatum ? [element("dekkingInTijdEinddatum", item.dekkingInTijdEinddatum, inspring + 2)] : []),
  ], inspring);
}

function event(item: MdtoEvent, inspring: number) {
  return blok("event", [
    begrip("eventType", item.eventType, inspring + 2),
    ...(item.eventTijd ? [element("eventTijd", item.eventTijd, inspring + 2)] : []),
    ...(item.eventVerantwoordelijkeActor ? [verwijzing("eventVerantwoordelijkeActor", item.eventVerantwoordelijkeActor, inspring + 2)] : []),
    ...(item.eventResultaat ? [element("eventResultaat", item.eventResultaat, inspring + 2)] : []),
  ], inspring);
}

function termijn(naam: string, item: MdtoTermijn, inspring: number) {
  return blok(naam, [
    ...(item.termijnTriggerStartLooptijd ? [begrip("termijnTriggerStartLooptijd", item.termijnTriggerStartLooptijd, inspring + 2)] : []),
    ...(item.termijnStartdatumLooptijd ? [element("termijnStartdatumLooptijd", item.termijnStartdatumLooptijd, inspring + 2)] : []),
    ...(item.termijnLooptijd ? [element("termijnLooptijd", item.termijnLooptijd, inspring + 2)] : []),
    ...(item.termijnEinddatum ? [element("termijnEinddatum", item.termijnEinddatum, inspring + 2)] : []),
  ], inspring);
}

function gerelateerd(item: MdtoGerelateerdInformatieobject, inspring: number) {
  return blok("gerelateerdInformatieobject", [
    verwijzing("gerelateerdInformatieobjectVerwijzing", item.gerelateerdInformatieobjectVerwijzing, inspring + 2),
    begrip("gerelateerdInformatieobjectTypeRelatie", item.gerelateerdInformatieobjectTypeRelatie, inspring + 2),
  ], inspring);
}

function beperkingGebruik(item: MdtoBeperkingGebruik, inspring: number) {
  return blok("beperkingGebruik", [
    begrip("beperkingGebruikType", item.beperkingGebruikType, inspring + 2),
    ...(item.beperkingGebruikNadereBeschrijving
      ? [element("beperkingGebruikNadereBeschrijving", item.beperkingGebruikNadereBeschrijving, inspring + 2)]
      : []),
  ], inspring);
}

function blok(naam: string, inhoud: string[], inspring: number) {
  const ruimte = " ".repeat(inspring);
  return [`${ruimte}<${naam}>`, ...inhoud, `${ruimte}</${naam}>`].join("\n");
}

function element(naam: string, waarde: string, inspring: number) {
  return `${" ".repeat(inspring)}<${naam}>${escape(waarde)}</${naam}>`;
}

function escape(tekst: string) {
  return tekst
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
