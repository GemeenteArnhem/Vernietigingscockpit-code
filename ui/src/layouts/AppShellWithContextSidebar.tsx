import { Outlet } from "react-router-dom";

import ContextSidebar from "../features/task-execution/components/ContextSidebar";
import Sidebar from "../components/Sidebar";

const metadata = [
  { label: "Recordmanager", value: "Jan de Vries" },
  { label: "Periode", value: "01-01-2019 t/m 31-12-2020" },
  { label: "Selectiedatum", value: "15-05-2025" },
  { label: "Startdatum", value: "15-05-2025" },
];

const auditItems = [
  {
    id: "1",
    date: "15-05-2025 10:48",
    title: "Toelichting toegevoegd",
    user: "Jan de Vries (recordmanager)",
    details: "Toelichting vastgelegd voor een uitgesloten object in de huidige selectie.",
  },
  {
    id: "2",
    date: "15-05-2025 10:47",
    title: "Reden geselecteerd",
    user: "Jan de Vries (recordmanager)",
    details: "De uitsluitreden is bijgewerkt op basis van de inhoudelijke beoordeling.",
  },
  {
    id: "3",
    date: "15-05-2025 10:46",
    title: "2 objecten uitgesloten",
    user: "Jan de Vries (recordmanager)",
    details: "Twee records zijn gemarkeerd als uitgesloten en wachten op complete toelichting.",
  },
  {
    id: "4",
    date: "15-05-2025 10:45",
    title: "Vernietigingslijst opgehaald",
    user: "Jan de Vries (recordmanager)",
    details: "De beoordelingsset is geladen en gereedgemaakt voor controle in de tabel.",
  },
];

const statistics = [
  {
    label: "Beoordeeld",
    value: "88% beoordeeld",
    tone: "blue" as const,
    hint: "1.100 van 1.248",
    progress: 88,
  },
  {
    label: "Afwijkingen",
    value: "12 afwijkingen",
    tone: "red" as const,
    hint: "Actie nodig",
    progress: 1,
  },
  {
    label: "Uitgesloten",
    value: "148 uitgesloten",
    tone: "amber" as const,
    hint: "12% van totaal",
  },
  {
    label: "Nog te valideren",
    value: "148 resterend",
    tone: "green" as const,
    hint: "Controle loopt",
    progress: 12,
  },
];

export default function AppShellWithContextSidebar() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="h-full overflow-auto px-5 pb-5 pt-0">
          <Outlet />
        </div>
      </main>

      <ContextSidebar
        metadata={metadata}
        statistics={statistics}
        auditItems={auditItems}
        positionClassName="relative h-full w-16 shrink-0"
        variant="shell"
      />
    </div>
  );
}
