import type { Prisma } from "@prisma/client";
import type { StekkerKandidaat } from "../../../src/modules/stekker/stekker-client.js";

// Testkandidaten volgens Stekker API v2 (MDTO-profiel, ADR-0005).

const BRON = "Testbron (technische sleutel)";
const SELECTIELIJST = "Testselectielijst";
const begrip = (begripLabel: string, begrippenlijst: string, begripCode?: string) => ({
  begripLabel,
  ...(begripCode ? { begripCode } : {}),
  begripBegrippenlijst: { verwijzingNaam: begrippenlijst },
});

// Een kandidaat zoals hij in de database staat (minimaal; overschrijfbaar).
export function mdtoKandidaat(
  kandidaatId: string,
  opties: { kenmerk?: string; naam?: string } & Partial<Prisma.VernietigingskandidaatCreateWithoutSelectieInput> = {}
): Prisma.VernietigingskandidaatCreateWithoutSelectieInput {
  const { kenmerk = `bron-${kandidaatId}`, naam = `Zaak ${kandidaatId}`, ...overrides } = opties;

  return {
    kandidaatId,
    identificatie: [{ identificatieKenmerk: kenmerk, identificatieBron: BRON }],
    identificatieKenmerken: kenmerk,
    naam,
    aggregatieniveau: "Dossier",
    waarderingBegripCode: "V",
    waarderingBegripLabel: "Tijdelijk te bewaren",
    termijnEinddatum: new Date(Date.UTC(2020, 0, 1)),
    informatiecategorieBegripLabel: "Testcategorie",
    informatiecategorieBegrippenlijst: { verwijzingNaam: SELECTIELIJST },
    selectielijst: SELECTIELIJST,
    ...overrides,
  };
}

// Een kandidaat zoals de stekker hem levert.
export function stekkerKandidaat(kandidaatId: string, kenmerk: string, naam: string): StekkerKandidaat {
  return {
    vernietigingskandidaatId: kandidaatId,
    identificatie: [{ identificatieKenmerk: kenmerk, identificatieBron: BRON }],
    naam,
    aggregatieniveau: { begripLabel: "Dossier", begripBegrippenlijst: { verwijzingNaam: "Begrippenlijst Aggregatieniveaus MDTO" } },
    waardering: { begripLabel: "Tijdelijk te bewaren", begripCode: "V", begripBegrippenlijst: { verwijzingNaam: "Begrippenlijst Waarderingen MDTO" } },
    bewaartermijn: { termijnEinddatum: "2020-01-01" },
    informatiecategorie: begrip("Testcategorie", SELECTIELIJST, "1.1"),
  };
}

// Het event Vernietigen dat bij SUCCESS hoort.
export function vernietigingsEvent(tijdstip = new Date()) {
  return {
    eventType: begrip("Vernietigen", "Begrippenlijst Eventtypen MDTO"),
    eventTijd: tijdstip.toISOString(),
  };
}

export function specificatieXml(kandidaatId: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<MDTO xmlns="https://www.nationaalarchief.nl/mdto"><informatieobject><naam>${kandidaatId}</naam></informatieobject></MDTO>\n`;
}
