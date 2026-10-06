import { describe, expect, it } from "vitest";
import { maakCsv, maakHtml, type VerklaringGegevens, type VerklaringMetadata } from "./verklaring-maker.js";

const rij = (overrides: Partial<VerklaringGegevens["rijen"][number]> = {}): VerklaringGegevens["rijen"][number] => ({
  kandidaatId: "vk-1",
  bronId: "bron-1",
  bronIdNaam: null,
  omschrijving: "Zaak 1",
  stekker: "Teststekker",
  classificatiesleutel: "A.1",
  selectielijst: "2017",
  grondslag: "1.1",
  bewaartermijn: "7 jaar",
  begindatum: "2010-01-01",
  einddatum: "2011-01-01",
  vernietigingsdatum: "2020-01-01",
  aantalObjecten: 3,
  aantalBetrokkenen: 1,
  beoordeling: "AKKOORD",
  uitsluitReden: null,
  vernietigingsstatus: "SUCCESS",
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
      rij({ kandidaatId: "vk-2", beoordeling: "UITGESLOTEN", uitsluitReden: 'Bezwaar, "lopend"', vernietigingsstatus: null }),
    ]);
    const [kop, eerste, tweede] = csv.split("\r\n");

    expect(kop).toContain("beoordeling,uitsluit_reden,vernietigingsstatus");
    expect(eerste).toContain(",AKKOORD,,SUCCESS,");
    expect(tweede).toContain(',UITGESLOTEN,"Bezwaar, ""lopend""",,');
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
      verantwoordelijken: {
        recordmanager: { naam: "Rita", email: "rita@example.test" },
        proceseigenaar: { naam: "Peter", email: "peter@example.test" },
        archivaris: { naam: "Anna", email: "anna@example.test" },
      },
    },
    stekkers: [],
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
  } as VerklaringMetadata;

  it("toont de onderdelen uit het bouwplan en escapet invoer", () => {
    const html = maakHtml(metadata);

    for (const tekst of ["Uitgesloten van vernietiging, per reden", "Lopende bezwaarprocedure", "Besluitvorming", "Teruggestuurd naar recordmanager", "keten intact", "ghi", "PDF/A-2b"]) {
      expect(html).toContain(tekst);
    }
    expect(html).toContain("Taak &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/concept/i);
  });
});
