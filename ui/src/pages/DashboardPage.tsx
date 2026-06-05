import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import 
{ 
    Search,
    Funnel
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import TaskProgress from "../components/TaskProgress";
import StatusBadge from "../components/StatusBadge";

type TaskExecutionStatus =
  | "VERTRAAGD"
  | "LOPEND"
  | "GEPLAND";

type TaskExecutionRow = {
  id: string;
  taskId: string;
  naam: string;
  subtitle: string;
  taskLabel: string;
  recordmanager: string;
  status: TaskExecutionStatus;
  stap: string;
  voortgang: number;
  dagenInStap: number;
  frequentie: string;
  highlighted?: boolean;
  vertraagd?: boolean;
};

const mockRows: TaskExecutionRow[] = [
  {
    id: "TI-102",
    taskId: "1",
    naam: "HR dossiers kwartaal",
    subtitle: "Gestart 4 mei 2026",
    taskLabel: "Taak: Personeelsvernietiging",
    recordmanager: "S. Janssen",
    status: "VERTRAAGD",
    stap: "Accordering PO",
    voortgang: 70,
    dagenInStap: 10,
    frequentie: "Kwartaal",
    vertraagd: true,
  },
  {
    id: "TI-100",
    taskId: "2",
    naam: "Zorgdomein jaarlijks",
    subtitle: "Gestart 10 mei 2026",
    taskLabel: "Taak: Zorgdomein jaarlijks",
    recordmanager: "Jan de Vries",
    status: "LOPEND",
    stap: "Beoordeling",
    voortgang: 40,
    dagenInStap: 4,
    frequentie: "Jaarlijks",
    highlighted: true,
  },
  {
    id: "TI-103",
    taskId: "3",
    naam: "IT projecten 2021",
    subtitle: "Gestart 12 mei 2026",
    taskLabel: "Taak: Projectarchief",
    recordmanager: "K. Bakker",
    status: "LOPEND",
    stap: "Uitvoering",
    voortgang: 65,
    dagenInStap: 2,
    frequentie: "Jaarlijks",
  },
  {
    id: "TI-104",
    taskId: "2",
    naam: "Finance jaarrekening",
    subtitle: "Volgende instantie - 1 januari 2027",
    taskLabel: "Taak: Financiele administratie",
    recordmanager: "P. Smit",
    status: "GEPLAND",
    stap: "Selectie",
    voortgang: 0,
    dagenInStap: 0,
    frequentie: "Jaarlijks",
  },
  {
    id: "TI-105",
    taskId: "4",
    naam: "Marketing campagnes Q2",
    subtitle: "Volgende instantie - 1 augustus 2026",
    taskLabel: "Taak: Marketingvernietiging",
    recordmanager: "L. van Hoeven",
    status: "GEPLAND",
    stap: "Selectie",
    voortgang: 0,
    dagenInStap: 0,
    frequentie: "Kwartaal",
  },
];

const STATUS_FILTERS: Array<{
  label: string;
  value: TaskExecutionStatus | null;
}> = [
  { label: "Alle resultaten", value: null },
  { label: "Vertraagd", value: "VERTRAAGD" },
  { label: "Lopend", value: "LOPEND" },
  { label: "Gepland", value: "GEPLAND" },
];

const STATUS_PRIORITY: Record<TaskExecutionStatus, number> = {
  VERTRAAGD: 0,
  LOPEND: 1,
  GEPLAND: 2,
};

function getActionLabel(status: TaskExecutionStatus) {
  if (status === "GEPLAND") {
    return "Starten";
  }

  return "Open";
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return { open, setOpen, ref };
}

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<TaskExecutionStatus | null>(null);
  const status = useDropdown();
  const isTaskOverview = location.pathname.startsWith("/taken");
  const pageTitle = isTaskOverview ? "Taken" : "Dashboard";
  const pageSubtitle = isTaskOverview
    ? "Taakuitvoeringen over alle taken, zonder voltooide uitvoeringen."
    : "Taakuitvoeringen die aandacht vragen, over alle taken heen.";
  const activeStatusLabel =
    STATUS_FILTERS.find((filter) => filter.value === statusFilter)?.label ??
    "Status filter";

  const filteredRows = mockRows
    .filter((row) => {
      if (statusFilter && row.status !== statusFilter) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      const query = search.trim().toLowerCase();

      return (
        row.naam.toLowerCase().includes(query) ||
        row.recordmanager.toLowerCase().includes(query) ||
        row.taskLabel.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const byStatus =
        STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];

      if (byStatus !== 0) {
        return byStatus;
      }

      return a.naam.localeCompare(b.naam);
    });

  return (
    <div className="flex flex-col gap-4 pt-4">
      <PageHeader
        titel={pageTitle}
        subtitel={pageSubtitle}
        actions={[]}
      />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Taakuitvoering
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Vertraagde, lopende en geplande uitvoeringen in werkvolgorde.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Search
                size={15}
                className="
                  absolute
                  left-0
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                "
              />
            </span>
            <input
              type="text"
              placeholder="Zoek op uitvoering, taak of recordmanager..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-72 rounded-md border border-gray-200 py-1.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>

          <div className="relative" ref={status.ref}>
            <button
              type="button"
              onClick={() => status.setOpen((current) => !current)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                status.open || statusFilter !== null
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-200 text-blue-600"
              }`}
            >
              <Funnel className="w-4 h-4" />
              {activeStatusLabel}
            </button>

            {status.open && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[190px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={String(filter.value)}
                    type="button"
                    onClick={() => {
                      setStatusFilter(filter.value);
                      status.setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      statusFilter === filter.value
                        ? "font-medium text-blue-600"
                        : "text-gray-700"
                    }`}
                  >
                    {filter.label}
                    {statusFilter === filter.value && (
                      <span className="text-xs text-blue-600">OK</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="h-12 text-xs uppercase text-gray-500">
                <th className="w-[340px] px-6 text-left">
                  Taakuitvoering
                </th>
                <th className="w-[180px] px-4 text-left">
                  Recordmanager
                </th>
                <th className="w-[120px] px-4 text-left">
                  Frequentie
                </th>
                <th className="w-[160px] px-4 text-left">
                  Status
                </th>
                <th className="w-[320px] px-4 text-left">
                  Voortgang
                </th>
                <th className="w-[180px] px-4 text-center">
                  Actie
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`h-[84px] border-b border-gray-100 transition-colors hover:bg-gray-50 ${
                    row.highlighted ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-6">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {row.naam}
                      </span>
                      <span className="mt-1 text-xs text-gray-500">
                        {row.subtitle}
                      </span>
                      <span className="mt-1 text-xs text-gray-400">
                        {row.taskLabel}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 text-gray-700">
                    {row.recordmanager}
                  </td>

                  <td className="px-4 text-gray-700">
                    {row.frequentie}
                  </td>

                  <td className="px-4">
                    <StatusBadge status={row.status} />
                  </td>

                  <td className="px-4">
                    {row.status === "GEPLAND" ? (
                      <span className="text-sm text-gray-400">
                        Start bij stap {row.stap}
                      </span>
                    ) : (
                      <TaskProgress
                        percentage={row.voortgang}
                        stap={row.stap}
                        dagen={row.dagenInStap}
                        vertraagd={row.vertraagd}
                      />
                    )}
                  </td>

                  <td className="px-4 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/taak/${row.taskId}/taakuitvoering/2/selectie`
                        )
                      }
                      className="inline-flex h-10 w-[170px] items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {getActionLabel(row.status)}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Geen taakuitvoeringen gevonden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
