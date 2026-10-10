import type { Prisma, Uitvoeringsresultaat, Vernietigingskandidaat } from "@prisma/client";
import { AUDIT_EVENTTYPEN, type AuditEventType } from "../audit/audit-eventtypen.js";
import {
  bestandXml,
  informatieobjectXml,
  type MdtoBegrip,
  type MdtoBeperkingGebruik,
  type MdtoEvent,
  type MdtoIdentificatie,
  type MdtoInformatieobject,
  type MdtoVerwijzing,
} from "./mdto-xml.js";
import { sha256 } from "./pakket-verificatie.js";

export { sha256 };

// Het vernietigingsdossier als MDTO (ADR-0005 §7, B-M5, B-M6). De cockpit beschrijft:
// - het dossier (aggregatieniveau Dossier) met als onderdelen verklaring, vernietigingslijst,
//   besluitvorming en auditlog (Archiefstuk), allemaal blijvend te bewaren;
// - elk bestand in het pakket met omvang, PRONOM-formaat, SHA-256 en isRepresentatieVan;
// - per aangeboden kandidaat het vernietigde informatieobject met het event Vernietigen
//   (of de uitkomst als het niet is vernietigd).
// De XML is deterministisch: dezelfde gegevens geven dezelfde bytes (en dezelfde SHA-256),
// zodat de checksum in de CSV-bijlage het bestand in het pakket dekt.

export const COCKPIT_BRON = "Vernietigingscockpit";

const lijst = (verwijzingNaam: string): MdtoVerwijzing => ({ verwijzingNaam });

const BEGRIPPENLIJST_WAARDERINGEN = "Begrippenlijst Waarderingen MDTO";
const BEGRIPPENLIJST_AGGREGATIENIVEAUS = "Begrippenlijst Aggregatieniveaus MDTO";

export const WAARDERING_BLIJVEND: MdtoBegrip = {
  begripLabel: "Blijvend te bewaren",
  begripCode: "B",
  begripBegrippenlijst: lijst(BEGRIPPENLIJST_WAARDERINGEN),
};

// De gebruiksbeperking van alle dossieronderdelen: het dossier bevat namen en kenmerken
// van vernietigde informatieobjecten en namen van medewerkers (ADR-0005 §9, gevolgen).
export const BEPERKING_PERSOONSGEGEVENS: MdtoBeperkingGebruik = {
  beperkingGebruikType: { begripLabel: "Openbaarheidsbeperking", begripBegrippenlijst: lijst("Begrippenlijst BeperkingGebruik MDTO") },
  beperkingGebruikNadereBeschrijving:
    "Bevat persoonsgegevens: namen en kenmerken van vernietigde informatieobjecten en namen van betrokken medewerkers.",
};

const SHA256: MdtoBegrip = { begripLabel: "SHA-256", begripBegrippenlijst: lijst("Begrippenlijst ChecksumAlgoritme MDTO") };

// Bestandsformaten (PRONOM-register van The National Archives).
export const FORMATEN = {
  pdfa2b: { begripLabel: "Acrobat PDF/A - Portable Document Format 2b", begripCode: "fmt/477", begripBegrippenlijst: lijst("PRONOM-register") },
  csv: { begripLabel: "Comma Separated Values", begripCode: "x-fmt/18", begripBegrippenlijst: lijst("PRONOM-register") },
  json: { begripLabel: "JSON Data Interchange Format", begripCode: "fmt/817", begripBegrippenlijst: lijst("PRONOM-register") },
} satisfies Record<string, MdtoBegrip>;

export function aggregatieniveau(begripLabel: "Dossier" | "Archiefstuk"): MdtoBegrip {
  return { begripLabel, begripBegrippenlijst: lijst(BEGRIPPENLIJST_AGGREGATIENIVEAUS) };
}

export function eventType(begripLabel: AuditEventType): MdtoBegrip {
  return { begripLabel, begripBegrippenlijst: lijst(AUDIT_EVENTTYPEN[begripLabel]) };
}

// Bestandsnamen in het pakket; op het cockpit-id, want het vernietigingskandidaatId is
// alleen uniek binnen een selectie.
export const kandidaatXmlNaam = (kandidaat: { id: string }) => `kandidaten/${kandidaat.id}.mdto.xml`;
export const specificatieNaam = (kandidaat: { id: string }) => `specificaties/${kandidaat.id}.xml`;

type KandidaatMetResultaat = Vernietigingskandidaat & { uitvoeringsresultaten: Uitvoeringsresultaat[] };

// Het vernietigde (of aangeboden maar niet vernietigde) informatieobject (B-M6).
export function kandidaatXml(
  kandidaat: KandidaatMetResultaat,
  zorgdrager: MdtoVerwijzing,
  vernietigingsmethode: string | null
) {
  const resultaat = kandidaat.uitvoeringsresultaten[0];
  const archiefvormer = json<MdtoVerwijzing[]>(kandidaat.archiefvormer);

  return informatieobjectXml({
    identificatie: json<MdtoIdentificatie[]>(kandidaat.identificatie) ?? [],
    naam: kandidaat.naam,
    aggregatieniveau: {
      begripLabel: kandidaat.aggregatieniveau,
      begripBegrippenlijst: lijst(BEGRIPPENLIJST_AGGREGATIENIVEAUS),
    },
    classificatie: json(kandidaat.classificatie) ?? undefined,
    omschrijving: json(kandidaat.omschrijving) ?? undefined,
    dekkingInTijd: json(kandidaat.dekkingInTijd) ?? undefined,
    event: resultaat?.resultaat ? [kandidaatEvent(resultaat, zorgdrager, vernietigingsmethode)] : undefined,
    waardering: {
      begripLabel: kandidaat.waarderingBegripLabel,
      begripCode: kandidaat.waarderingBegripCode,
      begripBegrippenlijst: lijst(BEGRIPPENLIJST_WAARDERINGEN),
    },
    bewaartermijn: {
      termijnTriggerStartLooptijd: json(kandidaat.termijnTriggerStartLooptijd),
      termijnStartdatumLooptijd: datum(kandidaat.termijnStartdatumLooptijd),
      termijnLooptijd: kandidaat.termijnLooptijd,
      termijnEinddatum: datum(kandidaat.termijnEinddatum),
    },
    informatiecategorie: {
      begripLabel: kandidaat.informatiecategorieBegripLabel,
      ...(kandidaat.informatiecategorieBegripCode ? { begripCode: kandidaat.informatiecategorieBegripCode } : {}),
      begripBegrippenlijst: json<MdtoVerwijzing>(kandidaat.informatiecategorieBegrippenlijst) ?? lijst(kandidaat.selectielijst),
    },
    isOnderdeelVan: json(kandidaat.isOnderdeelVan) ?? undefined,
    gerelateerdInformatieobject: json(kandidaat.gerelateerdInformatieobject) ?? undefined,
    archiefvormer: archiefvormer?.length ? archiefvormer : [zorgdrager],
    activiteit: json(kandidaat.activiteit) ?? undefined,
    beperkingGebruik: [BEPERKING_PERSOONSGEGEVENS],
  });
}

// Alleen SUCCESS is het event Vernietigen; een andere uitkomst is "Niet vernietigd"
// (Cockpit-eventtypen), met de uitkomst en de melding van de stekker als resultaat.
function kandidaatEvent(resultaat: Uitvoeringsresultaat, zorgdrager: MdtoVerwijzing, vernietigingsmethode: string | null): MdtoEvent {
  if (resultaat.resultaat === "SUCCESS") {
    return {
      eventType: eventType("Vernietigen"),
      eventTijd: resultaat.eventTijd?.toISOString(),
      eventVerantwoordelijkeActor: zorgdrager,
      eventResultaat: [
        "Vernietigd",
        vernietigingsmethode ? `vernietigingsmethode: ${vernietigingsmethode}` : null,
        resultaat.bronEventReferentie ? `bronEventReferentie: ${resultaat.bronEventReferentie}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    };
  }

  return {
    eventType: eventType("Niet vernietigd"),
    eventTijd: resultaat.ontvangenOp?.toISOString(),
    eventVerantwoordelijkeActor: zorgdrager,
    eventResultaat: [resultaat.resultaat, resultaat.foutcode, resultaat.foutmelding].filter(Boolean).join(": "),
  };
}

// --- Het dossier --------------------------------------------------------------------------

export type DossierInvoer = {
  taak: { id: string; naam: string; taakdefinitie: string; aangemaaktOp: string };
  zorgdrager: MdtoVerwijzing;
  gearchiveerdOp: string;
  verklaring: { pdf: Buffer; versie: number; gegenereerdOp: string };
  vernietigingslijst: { csv: Buffer; lijstHash: string | null; bevrorenOp: string | null; aantalKandidaten: number };
  auditlog: { json: Buffer; aantalEvents: number; laatsteHash: string | null; intact: boolean };
  // De besluiten (Voorgelegd, Accordering, Retour, Bevriezing, Vernietigingsopdracht, ...).
  besluiten: { eventType: AuditEventType; tijdstip: string; actor: string; resultaat: string }[];
};

export type PakketBestand = { naam: string; inhoud: Buffer; contentType: string };

const ONDERDELEN = {
  verklaring: { naam: "Vernietigingsverklaring", bestand: "verklaring.pdf", formaat: FORMATEN.pdfa2b, contentType: "application/pdf" },
  vernietigingslijst: { naam: "Vernietigingslijst", bestand: "bijlage.csv", formaat: FORMATEN.csv, contentType: "text/csv; charset=utf-8" },
  besluitvorming: { naam: "Besluitvorming", bestand: null, formaat: null, contentType: null },
  auditlog: { naam: "Auditlog", bestand: "auditlog.json", formaat: FORMATEN.json, contentType: "application/json" },
} as const;

type Onderdeel = keyof typeof ONDERDELEN;

// De dossierbestanden met hun MDTO-beschrijving. `dossier.mdto.xml` beschrijft het geheel;
// de adapter schrijft hem als laatste, zodat zijn aanwezigheid een compleet pakket betekent.
export function maakDossier(invoer: DossierInvoer): { bestanden: PakketBestand[]; dossierXml: Buffer } {
  const { taak, zorgdrager } = invoer;
  const kenmerk = (deel?: string): MdtoIdentificatie => ({
    identificatieKenmerk: deel ? `${taak.id}/${deel}` : taak.id,
    identificatieBron: COCKPIT_BRON,
  });
  const dossierVerwijzing: MdtoVerwijzing = { verwijzingNaam: `Vernietigingsdossier ${taak.naam}`, verwijzingIdentificatie: kenmerk() };
  const onderdeelVerwijzing = (onderdeel: Onderdeel): MdtoVerwijzing => ({
    verwijzingNaam: ONDERDELEN[onderdeel].naam,
    verwijzingIdentificatie: kenmerk(onderdeel),
  });
  const bestandVerwijzing = (naam: string): MdtoVerwijzing => ({ verwijzingNaam: naam, verwijzingIdentificatie: kenmerk(naam) });
  const basis = (onderdeel: Onderdeel): Omit<MdtoInformatieobject, "event"> => ({
    identificatie: [kenmerk(onderdeel)],
    naam: ONDERDELEN[onderdeel].naam,
    aggregatieniveau: aggregatieniveau("Archiefstuk"),
    waardering: WAARDERING_BLIJVEND,
    isOnderdeelVan: [dossierVerwijzing],
    heeftRepresentatie: ONDERDELEN[onderdeel].bestand ? [bestandVerwijzing(ONDERDELEN[onderdeel].bestand!)] : undefined,
    archiefvormer: [zorgdrager],
    beperkingGebruik: [BEPERKING_PERSOONSGEGEVENS],
  });
  const cockpit: MdtoVerwijzing = { verwijzingNaam: COCKPIT_BRON };

  const informatieobjecten: Record<Onderdeel, MdtoInformatieobject> = {
    verklaring: {
      ...basis("verklaring"),
      omschrijving: [`Verklaring van vernietiging, versie ${invoer.verklaring.versie}, PDF/A-2b.`],
      event: [{ eventType: eventType("Creatie"), eventTijd: invoer.verklaring.gegenereerdOp, eventVerantwoordelijkeActor: cockpit }],
    },
    vernietigingslijst: {
      ...basis("vernietigingslijst"),
      omschrijving: [
        `Lijst van ${invoer.vernietigingslijst.aantalKandidaten} vernietigingskandidaten met beoordeling en resultaat (CSV, MDTO-kolomnamen). Per aangeboden kandidaat staat de MDTO-beschrijving in kandidaten/ en bij vernietiging de specificatie van de stekker in specificaties/, met hun SHA-256 in de lijst.`,
      ],
      event: invoer.vernietigingslijst.bevrorenOp
        ? [
            {
              eventType: eventType("Bevriezing"),
              eventTijd: invoer.vernietigingslijst.bevrorenOp,
              eventResultaat: `Lijst-hash (SHA-256): ${invoer.vernietigingslijst.lijstHash ?? "-"}`,
            },
          ]
        : undefined,
    },
    besluitvorming: {
      ...basis("besluitvorming"),
      omschrijving: ["Besluiten over de vernietigingslijst: voorleggen, accorderen, terugsturen en de vernietigingsopdracht."],
      event: invoer.besluiten.map((besluit) => ({
        eventType: eventType(besluit.eventType),
        eventTijd: besluit.tijdstip,
        eventVerantwoordelijkeActor: { verwijzingNaam: besluit.actor },
        eventResultaat: besluit.resultaat,
      })),
    },
    auditlog: {
      ...basis("auditlog"),
      omschrijving: [
        `Auditlog van de taak: ${invoer.auditlog.aantalEvents} events in een hashketen (SHA-256), keten ${invoer.auditlog.intact ? "intact" : "NIET intact"}; laatste hash ${invoer.auditlog.laatsteHash ?? "-"}.`,
      ],
    },
  };

  const dossier = informatieobjectXml({
    identificatie: [kenmerk()],
    naam: dossierVerwijzing.verwijzingNaam,
    aggregatieniveau: aggregatieniveau("Dossier"),
    omschrijving: [`Vernietigingsdossier van taak ${taak.naam} (taakdefinitie ${taak.taakdefinitie}).`],
    event: [
      { eventType: eventType("Creatie"), eventTijd: taak.aangemaaktOp, eventVerantwoordelijkeActor: cockpit },
      { eventType: eventType("Export"), eventTijd: invoer.gearchiveerdOp, eventVerantwoordelijkeActor: cockpit },
    ],
    waardering: WAARDERING_BLIJVEND,
    bevatOnderdeel: (Object.keys(ONDERDELEN) as Onderdeel[]).map(onderdeelVerwijzing),
    archiefvormer: [zorgdrager],
    beperkingGebruik: [BEPERKING_PERSOONSGEGEVENS],
  });

  const inhoud: Record<string, Buffer> = {
    "verklaring.pdf": invoer.verklaring.pdf,
    "bijlage.csv": invoer.vernietigingslijst.csv,
    "auditlog.json": invoer.auditlog.json,
  };
  const bestanden: PakketBestand[] = [];

  for (const onderdeel of Object.keys(ONDERDELEN) as Onderdeel[]) {
    const { bestand, formaat, contentType } = ONDERDELEN[onderdeel];
    bestanden.push(xml(`${onderdeel}.mdto.xml`, informatieobjectXml(informatieobjecten[onderdeel])));

    if (bestand && formaat && contentType) {
      const data = inhoud[bestand];
      bestanden.push({ naam: bestand, inhoud: data, contentType });
      bestanden.push(
        xml(
          `${bestand}.mdto.xml`,
          bestandXml({
            identificatie: [kenmerk(bestand)],
            naam: bestand,
            omvang: data.length,
            bestandsformaat: formaat,
            checksum: [{ checksumAlgoritme: SHA256, checksumWaarde: sha256(data), checksumDatum: invoer.gearchiveerdOp }],
            isRepresentatieVan: onderdeelVerwijzing(onderdeel),
          })
        )
      );
    }
  }

  return { bestanden, dossierXml: Buffer.from(dossier, "utf8") };
}

function xml(naam: string, tekst: string): PakketBestand {
  return { naam, inhoud: Buffer.from(tekst, "utf8"), contentType: "application/xml" };
}

function json<T>(waarde: Prisma.JsonValue | null): T | null {
  return waarde === null ? null : (waarde as T);
}

function datum(waarde: Date | null) {
  return waarde ? waarde.toISOString().slice(0, 10) : null;
}
