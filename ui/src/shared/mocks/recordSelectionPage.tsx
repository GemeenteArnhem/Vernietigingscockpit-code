import {
  Building2,
  CalendarDays,
  Database,
  FileStack,
  FolderKanban,
  Mail,
  User,
} from "lucide-react";

import type { TaskExecutionConnector } from "../types/taskExecutionConnector";
import type {
  TaskExecutionHeaderMetaItem,
  TaskExecutionHeaderSummaryStats,
} from "../../features/task-execution/components/TaskExecutionHeader";

export const selectionTaskMetaItems: TaskExecutionHeaderMetaItem[] = [
  { label: "Recordmanager", value: "S. Janssen", icon: <User size={18} strokeWidth={1.8} /> },
  { label: "Eigenaar", value: "Jan de Vries", icon: <Building2 size={18} strokeWidth={1.8} /> },
  { label: "Archivaris", value: "M. Blom", icon: <User size={18} strokeWidth={1.8} /> },
  { label: "Startdatum", value: "31 mei 2026", icon: <CalendarDays size={18} strokeWidth={1.8} /> },
];

export const selectionSummaryStats: TaskExecutionHeaderSummaryStats = {
  teBeoordelen: 80,
  akkoord: 20,
  retour: 10,
  uitgesloten: 10,
};

export const selectionConnectors: TaskExecutionConnector[] = [
  {
    id: "suite4sociaaldomein",
    naam: "Suite4sociaaldomein",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "NIET_GESTART",
    voortgang: 0,
    laatsteRun: "Nog niet uitgevoerd",
    aantalObjecten: "-",
    melding: "De selectie is nog niet gestart voor deze stekker.",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "djuma",
    naam: "Djuma",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "BEZIG",
    voortgang: 42,
    laatsteRun: "31 mei 2026, 09:14",
    aantalObjecten: "1.284 objecten",
    melding: "Snapshot wordt opgebouwd. Resultaten zijn nog niet compleet.",
    icon: <FileStack className="h-4 w-4" />,
  },
  {
    id: "join",
    naam: "Join",
    versie: "1.0",
    stekkerStatus: "FOUT",
    selectieStatus: "GEDEELTELIJK_VOLTOOID",
    voortgang: 20,
    laatsteRun: "31 mei 2026, 09:08",
    aantalObjecten: "312 objecten",
    melding: "De selectie is deels gelukt. Herkansen is nodig voor ontbrekende resultaten.",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "onegov",
    naam: "Onegov",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "VOLTOOID",
    voortgang: 100,
    laatsteRun: "31 mei 2026, 09:02",
    aantalObjecten: "842 objecten",
    melding: "De snapshot is volledig opgehaald en klaar voor beoordeling.",
    icon: <Mail className="h-4 w-4" />,
  },
];
