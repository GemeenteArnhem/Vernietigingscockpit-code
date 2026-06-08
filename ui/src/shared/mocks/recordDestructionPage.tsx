import {
  Building2,
  CalendarDays,
  Database,
  FileStack,
  FolderKanban,
  Mail,
  User,
} from "lucide-react";

import type { TaskExecutionHeaderMetaItem, TaskExecutionHeaderSummaryStats } from "../../features/task-execution/components/TaskExecutionHeader";
import type { TaskExecutionDestructionConnector } from "../types/taskExecutionConnector";

export const destructionTaskMetaItems: TaskExecutionHeaderMetaItem[] = [
  { label: "Recordmanager", value: "S. Janssen", icon: <User size={18} strokeWidth={1.8} /> },
  { label: "Eigenaar", value: "Jan de Vries", icon: <Building2 size={18} strokeWidth={1.8} /> },
  { label: "Archivaris", value: "M. Blom", icon: <User size={18} strokeWidth={1.8} /> },
  { label: "Startdatum", value: "31 mei 2026", icon: <CalendarDays size={18} strokeWidth={1.8} /> },
];

export const destructionSummaryStats: TaskExecutionHeaderSummaryStats = {
  teBeoordelen: 80,
  akkoord: 20,
  retour: 10,
  uitgesloten: 10,
};

export const destructionConnectors: TaskExecutionDestructionConnector[] = [
  {
    id: "suite4sociaaldomein",
    naam: "Suite4sociaaldomein",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    vernietigingsStatus: "NIET_GESTART",
    voortgang: 0,
    laatsteRun: "Nog niet uitgevoerd",
    aantalObjecten: "-",
    melding: "De vernietiging is nog niet gestart voor deze stekker.",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "djuma",
    naam: "Djuma",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    vernietigingsStatus: "BEZIG",
    voortgang: 42,
    laatsteRun: "31 mei 2026, 09:14",
    aantalObjecten: "1.284 objecten",
    melding: "De vernietiging loopt. De geselecteerde objecten worden momenteel verwerkt.",
    icon: <FileStack className="h-4 w-4" />,
  },
  {
    id: "join",
    naam: "Join",
    versie: "1.0",
    stekkerStatus: "FOUT",
    vernietigingsStatus: "GEDEELTELIJK_VOLTOOID",
    voortgang: 20,
    laatsteRun: "31 mei 2026, 09:08",
    aantalObjecten: "312 objecten",
    melding: "De vernietiging is deels gelukt. Herkansen is nodig voor objecten die nog niet verwerkt zijn.",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "onegov",
    naam: "Onegov",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    vernietigingsStatus: "VOLTOOID",
    voortgang: 100,
    laatsteRun: "31 mei 2026, 09:02",
    aantalObjecten: "842 objecten",
    melding: "De vernietiging is volledig afgerond voor deze stekker.",
    icon: <Mail className="h-4 w-4" />,
  },
];
