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
    code: getSharedValue(items.map((item) => item.row.code ?? "-"), "Meerdere codes"),
    selectielijst: getSharedValue(items.map((item) => item.row.selectielijst ?? "-"), "Meerdere selectielijsten"),
    grondslag: getSharedValue(items.map((item) => item.row.grondslag ?? "-"), "Meerdere grondslagen"),
    bewaartermijn: getSharedValue(items.map((item) => `${item.row.bewaartermijn} jaar`), "Meerdere termijnen"),
    vernietigingsdatum:
      items.length > 0
        ? `${items[0]?.row.vernietigingsdatum ?? "-"} t/m ${items[items.length - 1]?.row.vernietigingsdatum ?? "-"}`
        : "-",
    periode: getSharedValue(
      items.map((item) => `${item.row.startdatum ?? "-"} / ${item.row.einddatum ?? "-"}`),
      "Meerdere periodes"
    ),
    status: Array.from(new Set(items.map((item) => statusLabel(item.queueStatus)))).join(", "),
    aantalObjecten: items.reduce((total, item) => total + item.row.aantalObjecten, 0),
    aantalBetrokkenen: items.reduce((total, item) => total + item.row.aantalBetrokkenen, 0),
    stekker: getSharedValue(items.map((item) => item.row.bron_systeem ?? "-"), "Meerdere stekkers"),
    volgnummer: volgnummers.length > 0 ? `${Math.min(...volgnummers)} t/m ${Math.max(...volgnummers)}` : "-",
  };
  const waarden = samenvatting
    ? {
        ...samenvatting,
        status: Array.from(new Set(samenvatting.beslissingen.map((beslissing) => statusLabel(decisionStatus(beslissing))))).join(", "),
      }
    : lokaal;

  return [
    { label: "Omschrijving", labelTitle: "Titel vernietigen informatieobjecten binnen de taak", value: `${aantal} geselecteerde records`, stacked: true },
    { label: "Code", labelTitle: "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.", value: waarden.code },
    { label: "Selectielijst", labelTitle: "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.", value: waarden.selectielijst },
    { label: "Grondslag", labelTitle: "De categorie/grondslag uit de vignerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden", value: waarden.grondslag },
    { label: "Bewaartermijn", labelTitle: "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst", value: waarden.bewaartermijn },
    { label: "Vernietigingsdatum", labelTitle: "Jaar en maand waarin het dossier/informatieobject vernietigd moet worden. Format: jjjj-mm", value: waarden.vernietigingsdatum },
    { label: "Periode", labelTitle: "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm", value: waarden.periode },
    { label: "Status", labelTitle: "Status van beoordeling: Akkoord, Retour, Uitgesloten, Uitgesteld", value: waarden.status },
    { label: "Aantal objecten", labelTitle: "Aantal objecten", value: waarden.aantalObjecten.toLocaleString("nl-NL") },
    { label: "Aantal betrokkenen", labelTitle: "Aantal betrokkenen", value: waarden.aantalBetrokkenen.toLocaleString("nl-NL") },
    { label: "Stekker", labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.", value: waarden.stekker },
    { label: "Bron-ID", labelTitle: "Identificatie van het informatieobject uit de stekker", value: `${aantal} records` },
    { label: "ID", labelTitle: "Cockpit identicatienummer.", value: "Meerdere records" },
    { label: "Volgnummer", labelTitle: "Een nummer binnen de taak die voor vernietiging in aanmerking komen", value: waarden.volgnummer },
  ];
}
