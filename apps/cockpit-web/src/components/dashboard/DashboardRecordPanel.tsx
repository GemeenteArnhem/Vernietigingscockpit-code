import {
  ChevronsUpDown,
  FolderArchive,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import ContentPanel, {
  ContentPanelEmptyState,
} from "../ContentPanel";
import type {
  RecordPaneBarFilter,
  RecordPaneBarTab,
} from "../record-pane/RecordPaneBar";
import { reviewSummaryStatusStyles } from "../../shared/ui/reviewStatusStyles";
import type {
  DashboardWorkflowStepId,
  TaskExecutionStatus,
} from "../../shared/types/dashboard";

type DashboardTableRow = {
  id: string;
  taakuitvoering: string;
  stapId: DashboardWorkflowStepId;
  status: TaskExecutionStatus;
  voortgangLabel: string;
  progress: number;
  recordmanager: string;
  startdatum: string;
};

type Props = {
  recordId?: string | null;
  rows?: DashboardTableRow[];
  onSelect?: (id: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  tabs: RecordPaneBarTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  filters: RecordPaneBarFilter[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
};

const DASHBOARD_STEPS: DashboardWorkflowStepId[] = [
  "SELECTIE",
  "BEOORDELING",
  "ACCORDERING_PO",
  "ACCORDERING_ARCH",
  "UITVOERING",
  "RESULTAAT",
];

function DashboardProgressStepper({
  stepId,
  status,
}: {
  stepId: DashboardWorkflowStepId;
  status: TaskExecutionStatus;
}) {
  const activeIndex = DASHBOARD_STEPS.findIndex((step) => step === stepId);
  const isDelayed = status === "VERTRAAGD";
  const isPlanned = status === "GEPLAND";
  const completeDotClass =
    reviewSummaryStatusStyles.akkoord.dot;
  const activeDotClass = isDelayed
    ? reviewSummaryStatusStyles.retour.dot
    : isPlanned
      ? reviewSummaryStatusStyles.uitgesteld.dot
      : reviewSummaryStatusStyles.teBeoordelen.dot;
  const activeBorderClass = isDelayed
    ? "border-amber-300 ring-amber-100"
    : isPlanned
      ? "border-slate-300 ring-slate-100"
      : "border-sky-300 ring-sky-100";
  const pendingDotClass =
    isPlanned
      ? "border-slate-300 bg-slate-100"
      : "border-slate-300 bg-white";
  const completeLineClass =
    reviewSummaryStatusStyles.akkoord.progress;
  const pendingLineClass =
    isPlanned ? "bg-slate-200" : "bg-slate-300";

  return (
    <div
      className="flex items-center"
      aria-label={`Workflow stap ${activeIndex + 1} van ${DASHBOARD_STEPS.length}`}
    >
      {DASHBOARD_STEPS.map((step, index) => {
        const isComplete = index < activeIndex;
        const isActive = index === activeIndex;
        const isLast = index === DASHBOARD_STEPS.length - 1;

        return (
          <div key={step} className="flex min-w-0 flex-1 items-center">
            <div
              className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 shadow-sm ${
                isComplete
                  ? `${completeDotClass} border-emerald-200 shadow-emerald-100`
                  : isActive
                    ? `${activeDotClass} bg-white ring-2 ${activeBorderClass} shadow-slate-100`
                    : pendingDotClass
              }`}
            />
            {!isLast ? (
              <div
                className={`mx-1 h-px min-w-2 flex-1 ${
                  isComplete
                    ? completeLineClass
                    : pendingLineClass
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardRecordPanel({
  recordId = null,
  rows = [],
  onSelect,
  searchValue,
  onSearchChange,
  tabs,
  activeTab,
  onTabChange,
  filters,
  activeFilter,
  onFilterChange,
}: Props) {
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const activeTabLabel =
    tabs.find((tab) => tab.key === activeTab)?.label ?? "Werkvoorraad";
  const activeFilterLabel =
    filters.find((filter) => filter.key === activeFilter)?.label ?? "Alle";
  const activeTabCount =
    tabs.find((tab) => tab.key === activeTab)?.count;
  const activeChips = useMemo(
    () =>
      [
        activeTab !== "mijn"
          ? {
              key: "tab",
              label: "Werkvoorraad",
              value: activeTabLabel,
              onClear: () => onTabChange("mijn"),
            }
          : null,
        activeFilter !== "alle"
          ? {
              key: "filter",
              label: "Status",
              value: activeFilterLabel,
              onClear: () => onFilterChange("alle"),
            }
          : null,
      ].filter(Boolean) as Array<{
        key: string;
        label: string;
        value: string;
        onClear: () => void;
      }>,
    [activeFilter, activeFilterLabel, activeTab, activeTabLabel, onFilterChange, onTabChange]
  );

  if (rows.length === 0) {
    return (
      <ContentPanel>
        <ContentPanelEmptyState
          icon={<FolderArchive size={24} />}
          title="Geen taken binnen deze selectie"
          description="Pas je zoekopdracht of filters aan om taakuitvoeringen te tonen."
        />
      </ContentPanel>
    );
  }

  return (
    <ContentPanel className="bg-white">
      <section className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative min-w-0 flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchValue}
                  onChange={(event) =>
                    onSearchChange(
                      event.target.value
                    )
                  }
                  placeholder="Zoek op titel, stap of startdatum..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                />
              </label>

              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTabMenuOpen((current) => !current)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <ListFilter size={16} />
                  {activeTabLabel}
                  {typeof activeTabCount === "number" ? (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {activeTabCount}
                    </span>
                  ) : null}
                  <ChevronsUpDown size={12} />
                </button>

                {tabMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                          onTabChange(tab.key);
                          setTabMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                          activeTab === tab.key
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{tab.label}</span>
                        {typeof tab.count === "number" ? (
                          <span className="text-xs text-slate-500">{tab.count}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                  >
                    <span className="font-medium text-slate-500">{chip.label}:</span>
                    <span>{chip.value}</span>
                    <button
                      type="button"
                      onClick={chip.onClear}
                      className="text-slate-400 transition hover:text-slate-700"
                      aria-label={`Verwijder filter ${chip.label}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterMenuOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <ListFilter size={14} />
                  + Filter toevoegen
                </button>

                {filterMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/70">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Status
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {filters.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => {
                            onFilterChange(filter.key);
                            setFilterMenuOpen(false);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            activeFilter === filter.key
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-white">
              <tr className="border-b border-slate-200">
                <th className="w-[34%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Taakuitvoering
                </th>
                <th className="w-[30%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Voortgang
                </th>
                <th className="w-[18%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Recordmanager
                </th>
                <th className="w-[18%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Startdatum
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isActive = recordId === row.id;

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect?.(row.id)}
                    className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${
                      isActive ? "bg-blue-50/50" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="truncate font-medium text-slate-900">
                        {row.taakuitvoering}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">
                        {row.voortgangLabel}
                      </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <DashboardProgressStepper
                              stepId={row.stapId}
                              status={row.status}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-medium text-slate-500">
                            {row.progress}%
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-700">
                      {row.recordmanager}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-700">
                      {row.startdatum}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          {rows.length.toLocaleString("nl-NL")} taken geladen
        </div>
      </section>
    </ContentPanel>
  );
}
