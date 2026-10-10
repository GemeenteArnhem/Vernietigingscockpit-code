import { describe, expect, it } from "vitest";
import { maakCsv, maakHtml, type VerklaringGegevens, type VerklaringMetadata } from "./verklaring-maker.js";

const rij = (overrides: Partial<VerklaringGegevens["rijen"][number]> = {}): VerklaringGegevens["rijen"][number] => ({
  id: "00000000-0000-4000-8000-000000000001",
  vernietigingskandidaatId: "vk-1",
  identificatieKenmerk: "bron-1 | ZAAK-1",
  identificatieBron: "Bron | Zaaknummering",
  naam: "Zaak 1",
  aggregatieniveau: "Dossier",
  stekker: "Teststekker",
  classificatieBegripCode: "A.1",
  classificatieBegripLabel: "Zaaktype A",
  dekkingInTijdBegindatum: "2010-01-01",
  dekkingInTijdEinddatum: "2011-01-01",
  waardering: "Tijdelijk te bewaren",
  termijnTriggerStartLooptijd: "Afgehandeld",
  termijnStartdatumLooptijd: "2011-01-01",
  termijnLooptijd: "P7Y",
  termijnEinddatum: "2018-01-01",
  informatiecategorieBegripCode: "1.1",
  informatiecategorieBegripLabel: "Categorie 1.1",
  informatiecategorieBegrippenlijst: "Selectielijst 2017",
  archiefvormer: "Gemeente Voorbeeld",
  aantalObjecten: 3,
  aantalBetrokkenen: 1,
  beoordeling: "AKKOORD",
  uitsluitreden: null,
  resultaat: "SUCCESS",
  eventType: "Vernietigen",
  eventTijd: "2026-10-01T08:00:00.000Z",
  bronEventReferentie: null,
  vernietigingsmethode: "Overschreven",
  mdtoXml: "kandidaten/00000000-0000-4000-8000-000000000001.mdto.xml",
  mdtoXmlSha256: "aa",
  specificatie: "specificaties/00000000-0000-4000-8000-000000000001.xml",
  specificatieSha256: "bb",
  foutcode: null,
  foutmelding: null,
  bronstatus: null,
  logReference: null,
  correlatieId: null,
  ...overrides,
});

describe("CSV-bijlage", () => {
  it("bevat ook uitgesloten kandidaten, met beoordeling en reden, en escapet waarden", () => {
    const csv = maakCsv([
      rij(),
      rij({
        vernietigingskandidaatId: "vk-2",
        beoordeling: "UITGESLOTEN",
        uitsluitreden: 'Bezwaar, "lopend"',
        resultaat: null,
        eventType: null,
        eventTijd: null,
        vernietigingsmethode: null,
        mdtoXml: null,
        mdtoXmlSha256: null,
        specificatie: null,
        specificatieSha256: null,
      }),
    ]);
    const [kop, eerste, tweede] = csv.split("\r\n");

    expect(kop.split(",").slice(0, 4)).toEqual(["vernietigingskandidaatId", "identificatieKenmerk", "identificatieBron", "naam"]);
    expect(kop).toContain("termijnLooptijd,termijnEinddatum");
    expect(kop).toContain("beoordeling,uitsluitreden,resultaat,eventType,eventTijd");
    expect(kop).toContain("vernietigingsmethode,mdtoXml,mdtoXmlSha256,specificatie,specificatieSha256");
    expect(kop).not.toContain("id,");
    expect(eerste).toContain(",AKKOORD,,SUCCESS,Vernietigen,2026-10-01T08:00:00.000Z,,Overschreven,");
    expect(tweede).toContain(',UITGESLOTEN,"Bezwaar, ""lopend""",,,,');
  });
});

describe("HTML voor de PDF", () => {
  const metadata = {
    taak: {
      id: "taak-1",
      naam: "Taak <script>",
      status: "resultaat",
      stapSinds: "2026-10-01T10:00:00.000Z",
      taakdefinitie: "Definitie",
      peildatum: "2026-01-01",
      rondes: 2,
      afgerondOp: "2026-10-01T10:00:00.000Z",
      archiefvormer: "Gemeente Voorbeeld",
      verantwoordelijken: {
        recordmanager: { naam: "Rita", email: "rita@example.test" },
        proceseigenaar: { naam: "Peter", email: "peter@example.test" },
        archivaris: { naam: "Anna", email: "anna@example.test" },
      },
    },
    stekkers: [
      {
        naam: "Teststekker",
        stekkerversie: "2.0.0",
        configuratieversie: 1,
        apiVersie: "2.0.0",
        selectieId: "sel-1",
        peildatum: "2026-01-01",
        selectietijdstip: "2026-09-01T10:00:00.000Z",
        vernietigingId: "vern-1",
        vernietigingStatus: "COMPLETED",
        vernietigingAfgerondOp: "2026-10-01T09:00:00.000Z",
        besluitReferentie: "1",
        vernietigingsmethode: "Overschreven",
        vernietigingsmethodeToelichting: "Geen back-ups",
        eersteEventTijd: "2026-10-01T08:00:00.000Z",
        laatsteEventTijd: "2026-10-01T08:00:00.000Z",
        specificaties: 1,
      },
    ],
    tellingen: { aangeboden: 2, success: 2, failed: 0, notFound: 0, skipped: 0, changed: 0, aantalObjecten: 6, aantalBetrokkenen: 2, uitgesloten: 1 },
    uitgeslotenPerReden: [{ reden: "Lopende bezwaarprocedure", aantal: 1 }],
    besluitvorming: [
      { tijdstip: "2026-10-01T09:00:00.000Z", ronde: 1, naam: "Peter", rol: "Proceseigenaar", besluit: "Teruggestuurd naar recordmanager" },
    ],
    retourPerRonde: [{ ronde: 1, rol: "Proceseigenaar", aantal: 2 }],
    lijstHash: "abc",
    versie: 1,
    status: "gegenereerd",
    gegenereerdOp: "2026-10-01T10:00:00.000Z",
    bijlage: { bestandsnaam: "x.csv", contentType: "text/csv", aantalRegels: 3, sha256: "def" },
    integriteit: { lijstHash: "abc", auditlog: { aantalEvents: 10, laatsteHash: "ghi", intact: true } },
  } as unknown as VerklaringMetadata;

  it("toont de onderdelen uit het bouwplan en escapet invoer", () => {
    const html = maakHtml(metadata, [rij(), rij({ vernietigingskandidaatId: "vk-3", naam: "Zaak 3", resultaat: "NOT_FOUND", foutmelding: "Niet in de bron" })]);

    for (const tekst of [
      "Uitgesloten van vernietiging, per reden",
      "Lopende bezwaarprocedure",
      "Besluitvorming",
      "Teruggestuurd naar recordmanager",
      "keten intact",
      "ghi",
      "PDF/A-2b",
      "Archiefvormer",
      "Gemeente Voorbeeld",
      "Vernietigingsmethode",
      "Overschreven",
      "Geen back-ups",
      "1 MDTO-XML-specificaties",
      "Vernietigde informatieobjecten",
      "bron-1 | ZAAK-1",
      "Aangeboden, niet vernietigd",
      "Niet in de bron",
    ]) {
      expect(html).toContain(tekst);
    }
    expect(html).toContain("Taak &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/concept/i);
  });
});
