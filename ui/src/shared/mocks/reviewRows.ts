import type { VernietigingsObject } from "../types/destruction";

const SYSTEMS = [
  "Zaaksysteem A",
  "DMS B",
  "Archiefportaal C",
  "Taakapplicatie D",
];

const GRONDSLAGEN = [
  "Art. 3 Archiefwet",
  "Art. 5 Archiefbesluit",
  "Selectielijst 2020",
  "Mandaatbesluit DIV",
];

const TITELS = [
  "Contractdossier",
  "Projectdossier",
  "Subsidieaanvraag",
  "Inkoopdossier",
  "Vergunningzaak",
  "Personeelsmutatie",
  "Meldingsdossier",
  "Auditdocument",
];

const baseRows: VernietigingsObject[] = [
  {
    id: "1",
    titel: "Contracten 2021 - Leveranciers",
    omvang: 3,
    omvangDocumenten: 3,
    omvangClienten: 1,
    bewaartermijn: 7,
    vernietigingsdatum: "2026-01",
    uitgesloten: false,
    bron_id: "ZRC-2021-00441",
    code: "7.1.2",
    startdatum: "01-2021",
    einddatum: "12-2021",
    selectielijst: "VNG 2017",
    grondslag: "Art. 3 Archiefwet",
    bron_systeem: "Zaaksysteem A",
    proceseigenaarToelichting: "Kan worden vastgesteld.",
  },
  {
    id: "2",
    titel: "Projectdossier X",
    omvang: 5,
    omvangDocumenten: 5,
    omvangClienten: 2,
    bewaartermijn: 10,
    vernietigingsdatum: "2025-12",
    uitgesloten: true,
    reden: "Onbekend recordtype",
    toelichting: "",
    bron_id: "ZRC-2020-00182",
    code: "10.3.1",
    startdatum: "03-2020",
    einddatum: "11-2020",
    selectielijst: "VNG 2017",
    grondslag: "Art. 5 Archiefbesluit",
    bron_systeem: "DMS B",
  },
];

const generatedRows: VernietigingsObject[] = Array.from(
  { length: 118 },
  (_, index) => {
    const recordNumber = index + 3;
    const year = 2018 + (index % 7);
    const month = String((index % 12) + 1).padStart(2, "0");
    const endMonth = String(((index + 5) % 12) + 1).padStart(2, "0");
    const system = SYSTEMS[index % SYSTEMS.length];
    const grondslag = GRONDSLAGEN[index % GRONDSLAGEN.length];
    const titel = TITELS[index % TITELS.length];
    const isExcluded = recordNumber % 11 === 0;

    return {
      id: String(recordNumber),
      titel: `${titel} ${year}-${String(recordNumber).padStart(3, "0")}`,
      omvang: (index % 9) + 1,
      omvangDocumenten: (index % 9) + 1,
      omvangClienten: (index % 4) + 1,
      bewaartermijn: [3, 5, 7, 10, 15][index % 5],
      vernietigingsdatum: `${year + 5}-${month}`,
      uitgesloten: isExcluded,
      reden: isExcluded ? "Controle vereist" : undefined,
      toelichting: isExcluded ? "Nog beoordelen voor uitsluiting." : undefined,
      proceseigenaarToelichting:
        recordNumber % 4 === 0 ? "Controle uitgevoerd." : undefined,
      archivarisToelichting:
        recordNumber % 6 === 0 ? "Past binnen selectielijst." : undefined,
      bron_id: `ZRC-${year}-${String(400 + recordNumber).padStart(5, "0")}`,
      code: `${(index % 12) + 1}.${(index % 5) + 1}.${(index % 3) + 1}`,
      startdatum: `${month}-${year}`,
      einddatum: `${endMonth}-${year}`,
      selectielijst: index % 2 === 0 ? "VNG 2017" : "VNG 2020",
      grondslag,
      bron_systeem: system,
    };
  }
);

export const reviewRows: VernietigingsObject[] = [
  ...baseRows,
  ...generatedRows,
];
