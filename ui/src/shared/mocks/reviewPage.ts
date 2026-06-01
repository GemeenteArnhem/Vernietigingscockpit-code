import { reviewRows } from "./reviewRows";
import type {
  ReviewDecision,
  ReviewQueueStatus,
  ReviewRecordContext,
  ReviewRiskLevel,
} from "../types/review";

const RECORDMANAGER = "S. Janssen";
const PROCESEIGENAAR = "Jan de Vries";
const ARCHIVARIS = "M. Blom";
const TAAK_STARTDATUM = "31 mei 2026";
const PROCESSEN = [
  "Contractbeheer",
  "Vergunningverlening",
  "Subsidiebeheer",
  "Projectarchivering",
  "Meldingen openbare ruimte",
];

function getRiskLevel(index: number): ReviewRiskLevel {
  if (index % 7 === 0) {
    return "hoog";
  }

  if (index % 3 === 0) {
    return "middel";
  }

  return "laag";
}

function getQueueStatus(index: number): ReviewQueueStatus {
  if (index % 13 === 0) {
    return "retour";
  }

  if (index % 11 === 0) {
    return "conflict";
  }

  if (index % 5 === 0) {
    return "afgerond";
  }

  return "nog-te-beoordelen";
}

function getDefaultDecision(status: ReviewQueueStatus): ReviewDecision {
  if (status === "retour") {
    return "retour";
  }

  if (status === "afgerond") {
    return "akkoord";
  }

  return "open";
}

export const reviewTaskContext = {
  procesnaam: "Vernietigingslijst 2025",
  recordmanager: RECORDMANAGER,
  proceseigenaar: PROCESEIGENAAR,
  archivaris: ARCHIVARIS,
  startdatum: TAAK_STARTDATUM,
};

export const reviewRecordContexts: ReviewRecordContext[] = reviewRows.map(
  (row, index) => {
    const risiconiveau = getRiskLevel(index);
    const queueStatus = getQueueStatus(index);
    const bronSysteem = row.bron_systeem ?? "Zorgdomein";
    const proces = PROCESSEN[index % PROCESSEN.length];
    const vernietigbaarSinds = `${row.vernietigingsdatum ?? "-"}`;
    const redenen = [
      `Bewaartermijn van ${row.bewaartermijn} jaar is verstreken volgens ${row.selectielijst ?? "de geldende selectielijst"}.`,
      row.uitgesloten
        ? "Er is een eerdere markering voor controle of uitsluiting aanwezig."
        : "Er zijn geen actieve blokkades of openstaande bewaarverzoeken gevonden.",
      `Broncontrole uitgevoerd op ${bronSysteem}${row.code ? `, categorie ${row.code}` : ""}.`,
    ];

    return {
      recordId: row.id,
      proces,
      recordmanager: RECORDMANAGER,
      proceseigenaar: PROCESEIGENAAR,
      archivaris: ARCHIVARIS,
      startdatumTaak: TAAK_STARTDATUM,
      vernietigbaarSinds,
      risiconiveau,
      queueStatus,
      beoordelingsRedenen: redenen,
      aandachtspunt:
        queueStatus === "conflict"
          ? "Er is een inhoudelijk verschil tussen metadata en eerder vastgelegde beoordeling."
          : queueStatus === "retour"
            ? "De vorige controle bevatte een verzoek om extra toelichting."
            : undefined,
      workflow: [
        {
          actor: "Recordmanager",
          detail: "Selectie samengesteld",
          state: "done",
          timestamp: "31 mei 2026, 09:12",
        },
        {
          actor: "Proceseigenaar",
          detail:
            queueStatus === "afgerond"
              ? "Beoordeling afgerond"
              : "Wacht op beoordeling",
          state: queueStatus === "afgerond" ? "done" : "active",
          timestamp:
            queueStatus === "afgerond" ? "31 mei 2026, 11:02" : undefined,
        },
        {
          actor: "Archivaris",
          detail: "Nog niet gestart",
          state: "upcoming",
        },
      ],
      comments:
        queueStatus === "retour"
          ? [
              {
                author: "M. Blom",
                role: "Archivaris",
                message:
                  "Graag verduidelijken waarom dit record binnen de grondslag valt.",
                timestamp: "31 mei 2026, 10:24",
              },
            ]
          : row.proceseigenaarToelichting
            ? [
                {
                  author: PROCESEIGENAAR,
                  role: "Proceseigenaar",
                  message: row.proceseigenaarToelichting,
                  timestamp: "31 mei 2026, 10:18",
                },
              ]
            : [
                {
                  author: RECORDMANAGER,
                  role: "Recordmanager",
                  message:
                    "Controle op metadata afgerond, gereed voor inhoudelijke beoordeling.",
                  timestamp: "31 mei 2026, 09:48",
                },
              ],
    };
  }
);

export const initialReviewDecisions = Object.fromEntries(
  reviewRecordContexts.map((context) => [
    context.recordId,
    getDefaultDecision(context.queueStatus),
  ])
) as Record<string, ReviewDecision>;
