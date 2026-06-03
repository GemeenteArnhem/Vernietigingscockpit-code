import { destructionResultRows } from "./destructionResultRows";
import type {
  DestructionResultActionOption,
  DestructionResultContext,
  DestructionResultStatus,
  DestructionResultTaskContext,
} from "../types/destructionResult";

const RECORDMANAGER = "S. Janssen";
const PROCESEIGENAAR = "Jan de Vries";
const ARCHIVARIS = "M. Blom";
const TAAK_STARTDATUM = "31 mei 2026";

function getStatusDetail(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCES":
      return "Record is verwijderd in het bronsysteem en verwerkt in het auditspoor.";
    case "FOUT":
      return "Uitvoering is gestopt door een technische fout of autorisatieprobleem.";
    case "NIET_GEVONDEN":
      return "Bronrecord was niet meer aanwezig tijdens de vernietigingsactie.";
    default:
      return "Record is overgeslagen en vraagt om aanvullende opvolging.";
  }
}

function getNextStep(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCES":
      return "Opnemen in de verklaring en gereedmaken voor archivering.";
    case "FOUT":
      return "Herstelactie plannen en de connectoruitvoer opnieuw beoordelen.";
    case "NIET_GEVONDEN":
      return "Vastleggen als niet gevonden en controleren of bronmutatie is verwacht.";
    default:
      return "Afstemmen met recordmanager of dit record opnieuw moet worden aangeboden.";
  }
}

export const destructionResultTaskContext: DestructionResultTaskContext = {
  procesnaam: "Vernietigingslijst 2025",
  recordmanager: RECORDMANAGER,
  proceseigenaar: PROCESEIGENAAR,
  archivaris: ARCHIVARIS,
  startdatum: TAAK_STARTDATUM,
};

export const destructionResultActions: DestructionResultActionOption[] = [
  {
    id: "verklaring-downloaden",
    title: "Verklaring downloaden",
    description: "Download de vernietigingsverklaring voor het geselecteerde resultaat.",
    tone: "primary",
  },
  {
    id: "resultaat-exporteren",
    title: "Resultaat exporteren",
    description: "Exporteer de uitvoergegevens van dit resultaat voor verdere verwerking.",
    tone: "neutral",
  },
  {
    id: "archiveren",
    title: "Archiveren",
    description: "Markeer het geselecteerde resultaat als gereed voor archivering.",
    tone: "warning",
  },
];

export const destructionResultContexts: DestructionResultContext[] =
  destructionResultRows.map((row) => ({
    recordId: row.id,
    recordmanager: RECORDMANAGER,
    proceseigenaar: PROCESEIGENAAR,
    archivaris: ARCHIVARIS,
    startdatumTaak: TAAK_STARTDATUM,
    bronSysteem: row.bron_systeem ?? row.stekker,
    omvangLabel: `${row.omvang ?? 0} ${row.omvang === 1 ? "object" : "objecten"}`,
    statusDetail: getStatusDetail(row.vernietigingsstatus),
    vervolgstap: getNextStep(row.vernietigingsstatus),
    comments: [
      {
        author: "Uitvoerservice",
        role: "Systeem",
        message: row.melding ?? "Geen aanvullende melding beschikbaar.",
        timestamp: "1 juni 2026, 16:02",
      },
    ],
  }));
