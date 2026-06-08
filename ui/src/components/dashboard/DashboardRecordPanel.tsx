import { FolderArchive, Search } from "lucide-react";

import ContentPanel, {
  ContentPanelEmptyState,
} from "../ContentPanel";
import type {
  RecordPaneBarFilter,
  RecordPaneBarTab,
} from "../record-pane/RecordPaneBar";

type DashboardTableRow = {
  id: string;
  taakuitvoering: string;
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
  if (rows.length === 0) {
    return (
      <ContentPanel>
        <ContentPanelEmptyState
          icon={<FolderArchive size={24} />}
          title="Kies een taak uit de werkvoorraad"
          description="Na selectie tonen we hier de taken in tabelvorm."
        />
      </ContentPanel>
    );
  }

  return (
    <ContentPanel className="bg-white">
      <section className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative w-full min-w-0 flex-1 lg:max-w-[360px]">
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
                  placeholder="Zoek op titel, selectieregel of vernietigingsdatum..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const active =
                    activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() =>
                        onTabChange(tab.key)
                      }
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {typeof tab.count ===
                        "number" && (
                        <span
                          className={`inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs ${
                            active
                              ? "bg-white text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active =
                  activeFilter ===
                  filter.key;

                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() =>
                      onFilterChange(
                        filter.key
                      )
                    }
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
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
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${Math.max(
                                  Math.min(
                                    row.progress,
                                    100
                                  ),
                                  0
                                )}%`,
                              }}
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
