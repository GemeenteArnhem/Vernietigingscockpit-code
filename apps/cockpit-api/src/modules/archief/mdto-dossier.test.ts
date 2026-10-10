import type { Uitvoeringsresultaat, Vernietigingskandidaat } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { valideerMdto } from "./mdto-xsd.testhulp.js";
import { kandidaatXml, maakDossier, sha256 } from "./mdto-dossier.js";

const zorgdrager = {
  verwijzingNaam: "Gemeente Voorbeeld",
  verwijzingIdentificatie: { identificatieKenmerk: "0000", identificatieBron: "CBS-gemeentecode" },
};

const kandidaat = (resultaat: Partial<Uitvoeringsresultaat> | null) =>
  ({
    id: "00000000-0000-4000-8000-000000000001",
    kandidaatId: "vk-1",
    identificatie: [{ identificatieKenmerk: "ZAAK-1", identificatieBron: "Zaaknummering" }],
    naam: "Zaak 1 & co",
    omschrijving: null,
    aggregatieniveau: "Dossier",
    classificatie: [{ begripLabel: "Zaaktype A", begripCode: "A.1", begripBegrippenlijst: { verwijzingNaam: "ZTC" } }],
    dekkingInTijd: [
      {
        dekkingInTijdType: { begripLabel: "Looptijd", begripBegrippenlijst: { verwijzingNaam: "Cockpit-dekkingInTijdtypen" } },
        dekkingInTijdBegindatum: "2010-01-01",
        dekkingInTijdEinddatum: "2011-01-01",
      },
    ],
    waarderingBegripCode: "V",
    waarderingBegripLabel: "Tijdelijk te bewaren",
    termijnTriggerStartLooptijd: { begripLabel: "Afgehandeld", begripBegrippenlijst: { verwijzingNaam: "Cockpit-termijntriggers" } },
    termijnStartdatumLooptijd: new Date("2011-01-01"),
    termijnLooptijd: "P7Y",
    termijnEinddatum: new Date("2018-01-01"),
    informatiecategorieBegripCode: "1.1",
    informatiecategorieBegripLabel: "Categorie 1.1",
    informatiecategorieBegrippenlijst: { verwijzingNaam: "Selectielijst 2017" },
    selectielijst: "Selectielijst 2017",
    informatiecategorieAfwijking: null,
    isOnderdeelVan: null,
    gerelateerdInformatieobject: null,
    archiefvormer: null,
    activiteit: null,
    beoordeling: "AKKOORD",
    uitvoeringsresultaten: resultaat ? [resultaat as Uitvoeringsresultaat] : [],
  }) as unknown as Vernietigingskandidaat & { uitvoeringsresultaten: Uitvoeringsresultaat[] };

const vernietigd = { resultaat: "SUCCESS", eventTijd: new Date("2026-10-01T08:00:00.000Z"), bronEventReferentie: "LOG-1", ontvangenOp: new Date("2026-10-01T08:01:00.000Z") };
const nietGevonden = { resultaat: "NOT_FOUND", foutcode: "NOT_FOUND", foutmelding: "Niet in de bron", ontvangenOp: new Date("2026-10-01T08:01:00.000Z") };

const geldig = (documenten: Record<string, string | Buffer>) => {
  const fouten = valideerMdto(documenten);
  // Zonder Python + lxml wordt de XSD-controle overgeslagen.
  if (fouten !== null) {
    expect(fouten).toEqual([]);
  }
};

describe("MDTO-beschrijving per kandidaat (B-M6)", () => {
  it("geeft bij SUCCESS het event Vernietigen met eventTijd, en is deterministisch en geldig volgens de XSD", () => {
    const xml = kandidaatXml(kandidaat(vernietigd), zorgdrager, "Overschreven");

    expect(xml).toBe(kandidaatXml(kandidaat(vernietigd), zorgdrager, "Overschreven"));
    expect(xml).toContain("<begripLabel>Vernietigen</begripLabel>");
    expect(xml).toContain("<eventTijd>2026-10-01T08:00:00.000Z</eventTijd>");
    expect(xml).toContain("vernietigingsmethode: Overschreven; bronEventReferentie: LOG-1");
    expect(xml).toContain("<naam>Zaak 1 &amp; co</naam>");
    // Zonder archiefvormer op de kandidaat: de zorgdrager van de taak.
    expect(xml).toContain("<verwijzingNaam>Gemeente Voorbeeld</verwijzingNaam>");
    geldig({ "succes.xml": xml });
  });

  it("geeft bij een andere uitkomst het event Niet vernietigd met de melding van de stekker", () => {
    const xml = kandidaatXml(kandidaat(nietGevonden), zorgdrager, "Overschreven");

    expect(xml).toContain("<begripLabel>Niet vernietigd</begripLabel>");
    expect(xml).not.toContain("<begripLabel>Vernietigen</begripLabel>");
    expect(xml).toContain("<eventResultaat>NOT_FOUND: NOT_FOUND: Niet in de bron</eventResultaat>");
    geldig({ "niet-gevonden.xml": xml });
  });
});

describe("Het vernietigingsdossier als MDTO-XML (ADR-0005 §7)", () => {
  const invoer = {
    taak: { id: "taak-1", naam: "Taak <1>", taakdefinitie: "Definitie", aangemaaktOp: "2026-09-01T10:00:00.000Z" },
    zorgdrager,
    gearchiveerdOp: "2026-10-02T10:00:00.000Z",
    verklaring: { pdf: Buffer.from("%PDF-1.7"), versie: 1, gegenereerdOp: "2026-10-01T10:00:00.000Z" },
    vernietigingslijst: { csv: Buffer.from("a,b\r\n1,2"), lijstHash: "abc", bevrorenOp: "2026-09-20T10:00:00.000Z", aantalKandidaten: 2 },
    auditlog: { json: Buffer.from("[]"), aantalEvents: 12, laatsteHash: "def", intact: true },
    besluiten: [
      { eventType: "Accordering" as const, tijdstip: "2026-09-20T10:00:00.000Z", actor: "Anna (Archivaris)", resultaat: "Vrijgegeven voor vernietiging" },
      { eventType: "Bevriezing" as const, tijdstip: "2026-09-20T10:00:00.000Z", actor: "Vernietigingscockpit", resultaat: "Lijst bevroren bij vrijgave" },
    ],
  };

  it("beschrijft dossier, onderdelen en bestanden met checksum, allemaal blijvend te bewaren en geldig volgens de XSD", () => {
    const { bestanden, dossierXml } = maakDossier(invoer);
    const namen = bestanden.map((bestand) => bestand.naam);

    expect(namen).toEqual([
      "verklaring.mdto.xml",
      "verklaring.pdf",
      "verklaring.pdf.mdto.xml",
      "vernietigingslijst.mdto.xml",
      "bijlage.csv",
      "bijlage.csv.mdto.xml",
      "besluitvorming.mdto.xml",
      "auditlog.mdto.xml",
      "auditlog.json",
      "auditlog.json.mdto.xml",
    ]);

    const tekst = (naam: string) => bestanden.find((bestand) => bestand.naam === naam)!.inhoud.toString("utf8");
    const dossier = dossierXml.toString("utf8");
    expect(dossier).toContain("<begripLabel>Dossier</begripLabel>");
    expect(dossier).toContain("<begripCode>B</begripCode>");
    expect(dossier.match(/<bevatOnderdeel>/g)).toHaveLength(4);
    expect(dossier).toContain("<begripLabel>Export</begripLabel>");
    expect(dossier).toContain("Taak &lt;1&gt;");

    const pdfBestand = tekst("verklaring.pdf.mdto.xml");
    expect(pdfBestand).toContain(`<checksumWaarde>${sha256(Buffer.from("%PDF-1.7"))}</checksumWaarde>`);
    expect(pdfBestand).toContain("<begripCode>fmt/477</begripCode>");
    expect(pdfBestand).toContain("<omvang>8</omvang>");
    expect(pdfBestand).toContain("<identificatieKenmerk>taak-1/verklaring</identificatieKenmerk>");
    expect(tekst("verklaring.mdto.xml")).toContain("<identificatieKenmerk>taak-1/verklaring.pdf</identificatieKenmerk>");
    expect(tekst("vernietigingslijst.mdto.xml")).toContain("<begripLabel>Bevriezing</begripLabel>");
    expect(tekst("besluitvorming.mdto.xml")).toContain("<verwijzingNaam>Anna (Archivaris)</verwijzingNaam>");
    // Informatieobjecten (niet de bestanden) hebben een gebruiksbeperking.
    for (const naam of namen.filter((naam) => naam.split(".").length === 3)) {
      expect(tekst(naam)).toContain("<begripLabel>Openbaarheidsbeperking</begripLabel>");
    }

    geldig({
      "dossier.mdto.xml": dossierXml,
      ...Object.fromEntries(bestanden.filter((bestand) => bestand.naam.endsWith(".mdto.xml")).map((bestand) => [bestand.naam, bestand.inhoud])),
    });
  });
});
