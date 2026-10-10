import type { Prisma, Vernietigingskandidaat } from "@prisma/client";
import type { ApiMdtoKandidaat } from "@vernietigingscockpit/api-contract";

// De MDTO-gegevens van een kandidaat (ADR-0005) zoals de cockpit-API ze teruggeeft: de
// gegevensgroepen ongewijzigd uit de kolommen, met MDTO-namen.
export function mdtoVelden(kandidaat: Vernietigingskandidaat): ApiMdtoKandidaat {
  return {
    vernietigingskandidaatId: kandidaat.kandidaatId,
    identificatie: json(kandidaat.identificatie) ?? [],
    naam: kandidaat.naam,
    omschrijving: json(kandidaat.omschrijving),
    aggregatieniveau: kandidaat.aggregatieniveau,
    classificatie: json(kandidaat.classificatie),
    dekkingInTijd: json(kandidaat.dekkingInTijd),
    waardering: {
      begripLabel: kandidaat.waarderingBegripLabel,
      begripCode: kandidaat.waarderingBegripCode,
      begripBegrippenlijst: { verwijzingNaam: "Begrippenlijst Waarderingen MDTO" },
    },
    bewaartermijn: {
      termijnTriggerStartLooptijd: json(kandidaat.termijnTriggerStartLooptijd),
      termijnStartdatumLooptijd: datum(kandidaat.termijnStartdatumLooptijd),
      termijnLooptijd: kandidaat.termijnLooptijd,
      termijnEinddatum: datum(kandidaat.termijnEinddatum) ?? "",
    },
    informatiecategorie: {
      begripLabel: kandidaat.informatiecategorieBegripLabel,
      ...(kandidaat.informatiecategorieBegripCode ? { begripCode: kandidaat.informatiecategorieBegripCode } : {}),
      begripBegrippenlijst: json(kandidaat.informatiecategorieBegrippenlijst) ?? { verwijzingNaam: kandidaat.selectielijst },
    },
    informatiecategorieAfwijking: json(kandidaat.informatiecategorieAfwijking),
    gerelateerdInformatieobject: json(kandidaat.gerelateerdInformatieobject),
    archiefvormer: json(kandidaat.archiefvormer),
    activiteit: json(kandidaat.activiteit),
    aantalObjecten: kandidaat.aantalObjecten,
    aantalBetrokkenen: kandidaat.aantalBetrokkenen,
    stekkerToelichting: kandidaat.stekkerToelichting,
  };
}

function json<T>(waarde: Prisma.JsonValue | null): T | null {
  return waarde === null ? null : (waarde as T);
}

function datum(waarde: Date | null) {
  return waarde ? waarde.toISOString().slice(0, 10) : null;
}
