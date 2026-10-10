import type { SelectieSamenvatting } from "../../../api/f3Data";
import type { VernietigingsKandidaat } from "../../../shared/types/destruction";
import type { ReviewDecision, ReviewQueueStatus } from "../../../shared/types/review";

// Detailpaneel bij een bulkselectie, gedeeld door beoordeling en accordering (CC-10).
// De selectie kan over meerdere pagina's gaan; dan komen de waarden uit de samenvatting
// van de server. Zolang die er (nog) niet is, rekenen we met de records op deze pagina.

type BulkItem = {
  row: VernietigingsKandidaat;
  queueStatus: ReviewQueueStatus;
  snapshotVolgnummer: number;
};

export const AGGREGATIENIVEAU_UITLEG = "Niveau van het informatieobject volgens MDTO: Archief, Serie, Dossier of Archiefstuk.";
export const WAARDERING_UITLEG = "Waardering volgens de selectielijst (MDTO): alleen Tijdelijk te bewaren komt in aanmerking voor vernietiging.";
export const ARCHIEFVORMER_UITLEG = "De organisatie die de informatieobjecten heeft gevormd of ontvangen (MDTO archiefvormer).";
// ADR-0007, DR-04: alleen de direct onderliggende informatieobjecten, gelijk aan bevatOnderdeel in de specificatie.
export const AANTAL_OBJECTEN_UITLEG = "Aantal direct onderliggende informatieobjecten: bij een dossier de archiefstukken, bij een serie de dossiers. Een archiefstuk heeft 0; bestanden tellen niet mee.";

function getSharedValue(values: string[], multipleLabel = "Meerdere") {
  const normalizedValues = Array.from(new Set(values.filter(Boolean)));

  if (normalizedValues.length === 0) {
    return "-";
  }

  return normalizedValues.length === 1 ? normalizedValues[0] : multipleLabel;
}

function decisionStatus(decision: ReviewDecision): ReviewQueueStatus {
  switch (decision) {
    case "akkoord":
      return "afgerond";
    case "uitsluiten":
      return "conflict";
    case "retour":
      return "retour";
    default:
      return "nog-te-beoordelen";
  }
}

export function maakBulkDetails(
  items: BulkItem[],
  aantal: number,
  samenvatting: SelectieSamenvatting | null,
  statusLabel: (status: ReviewQueueStatus) => string
) {
  const volgnummers = items.map((item) => item.snapshotVolgnummer).filter((volgnummer) => volgnummer > 0);
  const lokaal = {
    classificatie: getSharedValue(items.map((item) => item.row.classificatie ?? "-"), "Meerdere codes"),
    selectielijst: getSharedValue(items.map((item) => item.row.selectielijst ?? "-"), "Meerdere selectielijsten"),
    informatiecategorie: getSharedValue(items.map((item) => item.row.informatiecategorie ?? "-"), "Meerdere grondslagen"),
    termijnLooptijd: getSharedValue(items.map((item) => item.row.termijnLooptijd), "Meerdere termijnen"),
    termijnEinddatum:
      items.length > 0
        ? `${items[0]?.row.termijnEinddatum ?? "-"} t/m ${items[items.length - 1]?.row.termijnEinddatum ?? "-"}`
        : "-",
    dekkingInTijd: getSharedValue(
      items.map((item) => `${item.row.dekkingInTijdBegindatum ?? "-"} / ${item.row.dekkingInTijdEinddatum ?? "-"}`),
      "Meerdere periodes"
    ),
    status: Array.from(new Set(items.map((item) => statusLabel(item.queueStatus)))).join(", "),
    aantalObjecten: items.reduce((total, item) => total + item.row.aantalObjecten, 0),
    aantalBetrokkenen: items.reduce((total, item) => total + item.row.aantalBetrokkenen, 0),
    stekker: getSharedValue(items.map((item) => item.row.stekker ?? "-"), "Meerdere stekkers"),
    aggregatieniveau: getSharedValue(items.map((item) => item.row.aggregatieniveau ?? "-"), "Meerdere aggregatieniveaus"),
    waardering: getSharedValue(items.map((item) => item.row.waardering ?? "-"), "Meerdere waarderingen"),
    volgnummer: volgnummers.length > 0 ? `${Math.min(...volgnummers)} t/m ${Math.max(...volgnummers)}` : "-",
  };
  const waarden = samenvatting
    ? {
        ...samenvatting,
        status: Array.from(new Set(samenvatting.beslissingen.map((beslissing) => statusLabel(decisionStatus(beslissing))))).join(", "),
      }
    : lokaal;

  return [
    { label: "Naam", labelTitle: "Naam van het informatieobject", value: `${aantal} geselecteerde records`, stacked: true },
    { label: "Aggregatieniveau", labelTitle: AGGREGATIENIVEAU_UITLEG, value: waarden.aggregatieniveau },
    { label: "Waardering", labelTitle: WAARDERING_UITLEG, value: waarden.waardering },
    { label: "Classificatie", labelTitle: "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.", value: waarden.classificatie },
    { label: "Selectielijst", labelTitle: "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.", value: waarden.selectielijst },
    { label: "Informatiecategorie", labelTitle: "De categorie/grondslag uit de vignerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden", value: waarden.informatiecategorie },
    { label: "Bewaartermijn", labelTitle: "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst", value: waarden.termijnLooptijd },
    { label: "Einddatum bewaartermijn", labelTitle: "Jaar en maand waarin de bewaartermijn eindigt (MDTO termijnEinddatum). Format: jjjj-mm", value: waarden.termijnEinddatum },
    { label: "Dekking in tijd", labelTitle: "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm", value: waarden.dekkingInTijd },
    { label: "Status", labelTitle: "Status van beoordeling: Akkoord, Retour, Uitgesloten, Uitgesteld", value: waarden.status },
    { label: "Aantal objecten", labelTitle: AANTAL_OBJECTEN_UITLEG, value: waarden.aantalObjecten.toLocaleString("nl-NL") },
    { label: "Aantal betrokkenen", labelTitle: "Aantal betrokkenen", value: waarden.aantalBetrokkenen.toLocaleString("nl-NL") },
    { label: "Stekker", labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.", value: waarden.stekker },
    { label: "Identificatie", labelTitle: "Identificatie van het informatieobject uit de stekker", value: `${aantal} records` },
    { label: "ID", labelTitle: "Cockpit identicatienummer.", value: "Meerdere records" },
    { label: "Volgnummer", labelTitle: "Een nummer binnen de taak die voor vernietiging in aanmerking komen", value: waarden.volgnummer },
  ];
}
