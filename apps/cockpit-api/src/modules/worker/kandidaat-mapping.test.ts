import { describe, expect, it } from "vitest";
import type { StekkerKandidaat } from "../stekker/stekker-client.js";
import { mapKandidaatData } from "./kandidaat-mapping.js";

const lijst = (verwijzingNaam: string) => ({ verwijzingNaam });

const kandidaat: StekkerKandidaat = {
  vernietigingskandidaatId: " vk-1 ",
  identificatie: [
    { identificatieKenmerk: "8f74", identificatieBron: "Zaaksysteem (technische sleutel)" },
    { identificatieKenmerk: "ZAAK-2020-00421", identificatieBron: "Zaaknummering gemeente" },
  ],
  naam: "Handhaving ZAAK-2020-00421",
  aggregatieniveau: { begripLabel: "Dossier", begripBegrippenlijst: lijst("Begrippenlijst Aggregatieniveaus MDTO") },
  classificatie: [{ begripLabel: "Handhaving", begripCode: "ZTC-7", begripBegrippenlijst: lijst("ZTC") }],
  dekkingInTijd: [
    {
      dekkingInTijdType: { begripLabel: "Looptijd", begripCode: "looptijd", begripBegrippenlijst: lijst("Cockpit-dekkingInTijdtypen") },
      dekkingInTijdBegindatum: "2020-01-06",
      dekkingInTijdEinddatum: "2020-12-14",
    },
  ],
  waardering: { begripLabel: "Tijdelijk te bewaren", begripCode: "V", begripBegrippenlijst: lijst("Begrippenlijst Waarderingen MDTO") },
  bewaartermijn: {
    termijnTriggerStartLooptijd: { begripLabel: "Afgehandeld", begripCode: "afgehandeld", begripBegrippenlijst: lijst("Cockpit-termijntriggers") },
    termijnStartdatumLooptijd: "2020-12-15",
    termijnLooptijd: "P5Y",
    termijnEinddatum: "2025-12-15",
  },
  informatiecategorie: { begripLabel: "Handhaving", begripCode: "11.1.2", begripBegrippenlijst: lijst("Selectielijst gemeenten 2020") },
  aantalObjecten: 4,
  toelichting: "Uit de bron",
};

describe("mapKandidaatData (Stekker API v2 → MDTO-kolommen)", () => {
  it("neemt de MDTO-groepen over en leidt de zoek- en sorteerkolommen af", () => {
    const data = mapKandidaatData("sel-1", kandidaat);

    expect(data).toMatchObject({
      selectieId: "sel-1",
      kandidaatId: "vk-1",
      identificatie: kandidaat.identificatie,
      identificatieKenmerken: "8f74 | ZAAK-2020-00421",
      naam: "Handhaving ZAAK-2020-00421",
      aggregatieniveau: "Dossier",
      classificatieBegripCode: "ZTC-7",
      classificatieBegripLabel: "Handhaving",
      classificatieBegrippenlijst: "ZTC",
      dekkingInTijdBegindatum: "2020-01-06",
      dekkingInTijdEinddatum: "2020-12-14",
      waarderingBegripCode: "V",
      waarderingBegripLabel: "Tijdelijk te bewaren",
      termijnLooptijd: "P5Y",
      informatiecategorieBegripCode: "11.1.2",
      informatiecategorieBegripLabel: "Handhaving",
      selectielijst: "Selectielijst gemeenten 2020",
      aantalObjecten: 4,
      aantalBetrokkenen: 0,
      stekkerToelichting: "Uit de bron",
    });
    expect(data.termijnEinddatum).toEqual(new Date("2025-12-15T00:00:00.000Z"));
    expect(data.termijnStartdatumLooptijd).toEqual(new Date("2020-12-15T00:00:00.000Z"));
    // Geen ruwe stekkerpayload (dataminimalisatie).
    expect(data).not.toHaveProperty("bron");
  });

  it("laat ontbrekende optionele groepen leeg", () => {
    const { classificatie: _c, dekkingInTijd: _d, ...minimaal } = kandidaat;
    const data = mapKandidaatData("sel-1", minimaal);

    expect(data.classificatie).toBeUndefined();
    expect(data.classificatieBegripCode).toBeNull();
    expect(data.dekkingInTijdBegindatum).toBeNull();
  });
});
