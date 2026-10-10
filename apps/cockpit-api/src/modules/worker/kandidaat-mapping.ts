import type { Prisma } from "@prisma/client";
import type { StekkerKandidaat } from "../stekker/stekker-client.js";
import { parseDate } from "./worker-hulp.js";

// Een kandidaat uit Stekker API v2 (MDTO-profiel, ADR-0005) naar de kolommen van
// `vernietigingskandidaat`. De MDTO-gegevensgroepen gaan ongewijzigd mee als JSON; de waarden
// waarop de schermen zoeken, filteren en sorteren worden daaruit afgeleid. De ruwe payload
// wordt niet bewaard (dataminimalisatie).
export function mapKandidaatData(
  selectieId: string,
  kandidaat: StekkerKandidaat
): Prisma.VernietigingskandidaatUncheckedCreateInput {
  const classificatie = kandidaat.classificatie?.[0];
  const dekking = kandidaat.dekkingInTijd?.[0];
  const termijnEinddatum = parseDate(kandidaat.bewaartermijn.termijnEinddatum);

  if (!termijnEinddatum) {
    throw new Error(`Kandidaat ${kandidaat.vernietigingskandidaatId} mist een geldige bewaartermijn.termijnEinddatum.`);
  }

  return {
    selectieId,
    kandidaatId: kandidaat.vernietigingskandidaatId.trim(),
    identificatie: kandidaat.identificatie as Prisma.InputJsonValue,
    identificatieKenmerken: kandidaat.identificatie.map((item) => item.identificatieKenmerk).join(" | "),
    naam: kandidaat.naam.trim(),
    omschrijving: json(kandidaat.omschrijving),
    aggregatieniveau: kandidaat.aggregatieniveau.begripLabel,
    classificatie: json(kandidaat.classificatie),
    classificatieBegripCode: classificatie?.begripCode ?? null,
    classificatieBegripLabel: classificatie?.begripLabel ?? null,
    classificatieBegrippenlijst: classificatie?.begripBegrippenlijst.verwijzingNaam ?? null,
    dekkingInTijd: json(kandidaat.dekkingInTijd),
    dekkingInTijdBegindatum: dekking?.dekkingInTijdBegindatum ?? null,
    dekkingInTijdEinddatum: dekking?.dekkingInTijdEinddatum ?? null,
    waarderingBegripCode: kandidaat.waardering.begripCode,
    waarderingBegripLabel: kandidaat.waardering.begripLabel,
    termijnTriggerStartLooptijd: json(kandidaat.bewaartermijn.termijnTriggerStartLooptijd),
    termijnStartdatumLooptijd: parseDate(kandidaat.bewaartermijn.termijnStartdatumLooptijd),
    termijnLooptijd: kandidaat.bewaartermijn.termijnLooptijd ?? null,
    termijnEinddatum,
    informatiecategorieBegripCode: kandidaat.informatiecategorie.begripCode ?? null,
    informatiecategorieBegripLabel: kandidaat.informatiecategorie.begripLabel,
    informatiecategorieBegrippenlijst: kandidaat.informatiecategorie.begripBegrippenlijst as Prisma.InputJsonValue,
    selectielijst: kandidaat.informatiecategorie.begripBegrippenlijst.verwijzingNaam,
    informatiecategorieAfwijking: json(kandidaat.informatiecategorieAfwijking),
    isOnderdeelVan: json(kandidaat.isOnderdeelVan),
    gerelateerdInformatieobject: json(kandidaat.gerelateerdInformatieobject),
    archiefvormer: json(kandidaat.archiefvormer),
    activiteit: json(kandidaat.activiteit),
    aantalObjecten: kandidaat.aantalObjecten ?? 0,
    aantalBetrokkenen: kandidaat.aantalBetrokkenen ?? 0,
    stekkerToelichting: kandidaat.toelichting ?? null,
  };
}

function json(waarde: unknown) {
  return waarde === undefined || (Array.isArray(waarde) && waarde.length === 0) ? undefined : (waarde as Prisma.InputJsonValue);
}
