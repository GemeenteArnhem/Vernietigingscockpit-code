import {
  ArrowDown,
  ArrowUp,
  Archive,
  ChevronsUpDown,
  Columns3,
  Download,
  FileOutput,
  Info,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
} from "../components/ActionPanel";
import ContentPanel from "../components/ContentPanel";
import ShortcutPane from "../components/ShortcutPane";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  destructionResultActions,
  destructionResultContexts,
  resultSummaryStats,
  resultTaskMetaItems,
} from "../shared/mocks/destructionResultPage";
import { destructionResultRows } from "../shared/mocks/destructionResultRows";
import type {
  DestructionResultAction,
  DestructionResultContext,
  DestructionResultStatus,
} from "../shared/types/destructionResult";

type ResultSortKey = "omschrijving" | "vernietigingsstatus";
type ResultSortDirection = "asc" | "desc";
type SearchScope = "all" | "omschrijving" | "vernietigingsstatus";
type FacetFilterKey = "vernietigingsstatus" | "stekker";
type ResultTableRow = {
  id: string;
  omschrijving: string;
  vernietigingsstatus: DestructionResultStatus;
  stekker: string;
};

const PAGE_SIZE = 100;

const SEARCH_SCOPE_OPTIONS: Array<{ key: SearchScope; label: string }> = [
  { key: "all", label: "Alle kolommen" },
  { key: "omschrijving", label: "Omschrijving" },
  { key: "vernietigingsstatus", label: "Vernietigingsstatus" },
];

const FILTER_LABELS: Record<FacetFilterKey, string> = {
  vernietigingsstatus: "Vernietigingsstatus",
  stekker: "Stekker",
};

const COLUMN_LABELS: Record<ResultSortKey, string> = {
  omschrijving: "Omschrijving",
  vernietigingsstatus: "Vernietigingsstatus",
};

const COLUMN_TOOLTIPS: Record<ResultSortKey, string> = {
  omschrijving: "Titel van het record binnen de resultaatlijst.",
  vernietigingsstatus: "Uitkomst van de uitgevoerde vernietigingsactie.",
};

function getStatusLabel(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCES":
      return "Succes";
    case "FOUT":
      return "Fout";
    case "NIET_GEVONDEN":
      return "Niet gevonden";
    case "OVERIG":
      return "Overig";
  }
}

function getStatusBadgeClasses(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCES":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FOUT":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "NIET_GEVONDEN":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "OVERIG":
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getPaginationItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const pages = new Set<number>([
    0,
    1,
    totalPages - 2,
    totalPages - 1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 0 && page < totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }

    items.push(page);
  });

  return items;
}

function ResultTable({
  rows,
  activeRecordId,
  onActiveRecordChange,
  sortKey,
  sortDirection,
  onSortChange,
}: {
  rows: ResultTableRow[];
  activeRecordId: string | null;
  onActiveRecordChange: (id: string) => void;
  sortKey: ResultSortKey;
  sortDirection: ResultSortDirection;
  onSortChange: (key: ResultSortKey, direction: ResultSortDirection) => void;
}) {
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [searchScopeOpen, setSearchScopeOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Partial<Record<FacetFilterKey, string>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const facetOptions = useMemo(
    () => ({
      vernietigingsstatus: [
        "SUCCES",
        "FOUT",
        "NIET_GEVONDEN",
        "OVERIG",
      ].filter((status) =>
        rows.some((row) => row.vernietigingsstatus === status)
      ),
      stekker: Array.from(new Set(rows.map((row) => row.stekker))).sort(),
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack =
        searchScope === "omschrijving"
          ? row.omschrijving
          : searchScope === "vernietigingsstatus"
            ? getStatusLabel(row.vernietigingsstatus)
            : `${row.omschrijving} ${getStatusLabel(row.vernietigingsstatus)}`;

      const matchesSearch = !query ? true : haystack.toLowerCase().includes(query);
      const matchesStatus =
        !activeFilters.vernietigingsstatus
          ? true
          : row.vernietigingsstatus === activeFilters.vernietigingsstatus;
      const matchesStekker =
        !activeFilters.stekker ? true : row.stekker === activeFilters.stekker;

      return matchesSearch && matchesStatus && matchesStekker;
    });
  }, [activeFilters, rows, search, searchScope]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredRows.length);
  const visibleRows = filteredRows.slice(pageStart, pageEnd);
  const paginationItems = getPaginationItems(totalPages, safePage);
  const searchScopeLabel =
    SEARCH_SCOPE_OPTIONS.find((option) => option.key === searchScope)?.label ?? "Alle kolommen";

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = 0;
  }, [safePage, search, activeFilters, searchScope]);

  const setFacetFilter = (key: FacetFilterKey, value: string) => {
    setActiveFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setCurrentPage(0);
    setFilterMenuOpen(false);
  };

  const clearFacetFilter = (key: FacetFilterKey) => {
    setActiveFilters((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setCurrentPage(0);
  };

  const toggleSort = (column: ResultSortKey) => {
    const nextDirection =
      sortKey === column && sortDirection === "asc" ? "desc" : "asc";
    onSortChange(column, nextDirection);
    setCurrentPage(0);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(0);
                  }}
                  placeholder="Zoek op omschrijving of vernietigingsstatus..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-14 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                />
                <div className="absolute inset-y-1.5 right-1.5 flex items-center">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSearchScopeOpen((current) => !current)}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      aria-label="Kies zoekkolom"
                      title={`Zoek in: ${searchScopeLabel}`}
                    >
                      <ListFilter size={14} />
                      <ChevronsUpDown size={12} />
                    </button>

                    {searchScopeOpen ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70">
                        {SEARCH_SCOPE_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                              setSearchScope(option.key);
                              setSearchScopeOpen(false);
                              setCurrentPage(0);
                            }}
                            className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition ${
                              searchScope === option.key
                                ? "bg-blue-50 text-blue-700"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setColumnsOpen((current) => !current)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Columns3 size={16} />
                Kolommen
              </button>

              {columnsOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Weergave kolommen
                  </div>
                  <div className="space-y-1.5">
                    {(Object.keys(COLUMN_LABELS) as ResultSortKey[]).map((column) => (
                      <label
                        key={column}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        title={COLUMN_TOOLTIPS[column]}
                      >
                        <input
                          type="checkbox"
                          checked
                          readOnly
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{COLUMN_LABELS[column]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                Acties
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(activeFilters).map(([key, value]) => (
                <span
                  key={`${key}-${value}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-500">
                    {FILTER_LABELS[key as FacetFilterKey]}:
                  </span>
                  <span>
                    {key === "vernietigingsstatus"
                      ? getStatusLabel(value as DestructionResultStatus)
                      : value}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearFacetFilter(key as FacetFilterKey)}
                    className="text-slate-400 transition hover:text-slate-700"
                    aria-label={`Verwijder filter ${FILTER_LABELS[key as FacetFilterKey]}`}
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
                <div className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Filters
                  </div>
                  <div className="space-y-3">
                    {(Object.keys(FILTER_LABELS) as FacetFilterKey[]).map((filterKey) => (
                      <div key={filterKey}>
                        <div className="mb-1 text-sm font-medium text-slate-700">
                          {FILTER_LABELS[filterKey]}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {facetOptions[filterKey].map((option) => (
                            <button
                              key={`${filterKey}-${option}`}
                              type="button"
                              onClick={() => setFacetFilter(filterKey, option)}
                              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                activeFilters[filterKey] === option
                                  ? "border-blue-600 bg-blue-50 text-blue-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {filterKey === "vernietigingsstatus"
                                ? getStatusLabel(option as DestructionResultStatus)
                                : option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full table-auto text-sm">
          <colgroup>
            <col />
            <col style={{ width: "208px" }} />
          </colgroup>
          <thead className="bg-white">
            <tr className="border-b border-slate-200">
              {(["omschrijving", "vernietigingsstatus"] as ResultSortKey[]).map((column) => (
                <th
                  key={column}
                  title={COLUMN_TOOLTIPS[column]}
                  aria-sort={
                    sortKey === column
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="sticky top-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column)}
                    className="inline-flex w-full items-center gap-1.5 rounded-sm text-inherit outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    aria-label={`Sorteer op ${COLUMN_LABELS[column]}`}
                  >
                    {column === "vernietigingsstatus" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{COLUMN_LABELS[column]}</span>
                        <span className="text-slate-400">
                          <Info size={14} />
                        </span>
                      </span>
                    ) : (
                      <span>{COLUMN_LABELS[column]}</span>
                    )}

                    <span className="text-slate-400">
                      {sortKey === column ? (
                        sortDirection === "asc" ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ChevronsUpDown size={12} />
                      )}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row) => {
              const isActive = activeRecordId === row.id;

              return (
                <tr
                  key={row.id}
                  onClick={() => onActiveRecordChange(row.id)}
                  className={`border-b border-slate-100 transition hover:bg-slate-50 ${
                    isActive ? "bg-blue-50/50" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 align-middle text-slate-700">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onActiveRecordChange(row.id);
                      }}
                      className="truncate text-left font-medium text-slate-900 hover:text-blue-700"
                      title={row.omschrijving}
                    >
                      {row.omschrijving}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-middle text-slate-700">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                        row.vernietigingsstatus
                      )}`}
                    >
                      {getStatusLabel(row.vernietigingsstatus)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-2 text-sm text-slate-500">
        <div className="whitespace-nowrap">
          {filteredRows.length === 0
            ? "0 records"
            : `${(pageStart + 1).toLocaleString("nl-NL")}-${pageEnd.toLocaleString("nl-NL")} van ${filteredRows.length.toLocaleString("nl-NL")} records`}
        </div>
        <div className="flex items-center gap-1">
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex h-7 min-w-7 items-center justify-center px-1 text-xs font-medium text-slate-400"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setCurrentPage(item)}
                aria-current={item === safePage ? "page" : undefined}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-semibold transition ${
                  item === safePage
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item + 1}
              </button>
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default function DestructionResultPage() {
  const [selectedAction, setSelectedAction] = useState<DestructionResultAction>(
    destructionResultActions[0]?.id ?? "verklaring-downloaden"
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    destructionResultRows[0]?.id ?? null
  );
  const [sortKey, setSortKey] = useState<ResultSortKey>("omschrijving");
  const [sortDirection, setSortDirection] = useState<ResultSortDirection>("asc");
  const collator = useMemo(
    () => new Intl.Collator("nl", { numeric: true, sensitivity: "base" }),
    []
  );

  const resultRows = useMemo(() => destructionResultRows, []);
  const contextById = useMemo<Record<string, DestructionResultContext>>(
    () =>
      Object.fromEntries(
        destructionResultContexts.map((context) => [context.recordId, context])
      ),
    []
  );

  const sortedRows = useMemo(
    () =>
      [...resultRows].sort((left, right) => {
        const leftValue =
          sortKey === "omschrijving"
            ? left.titel
            : getStatusLabel(left.vernietigingsstatus);
        const rightValue =
          sortKey === "omschrijving"
            ? right.titel
            : getStatusLabel(right.vernietigingsstatus);
        const comparison = collator.compare(String(leftValue), String(rightValue));

        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [collator, resultRows, sortDirection, sortKey]
  );

  useEffect(() => {
    if (!sortedRows.some((row) => row.id === selectedId)) {
      setSelectedId(sortedRows[0]?.id ?? null);
    }
  }, [selectedId, sortedRows]);

  const selectedIndex = useMemo(
    () => sortedRows.findIndex((row) => row.id === selectedId),
    [selectedId, sortedRows]
  );
  const selectedRow = useMemo(
    () => sortedRows.find((row) => row.id === selectedId) ?? sortedRows[0],
    [selectedId, sortedRows]
  );
  const selectedContext = selectedRow ? contextById[selectedRow.id] : undefined;
  const previousRecord = selectedIndex > 0 ? sortedRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < sortedRows.length - 1
      ? sortedRows[selectedIndex + 1]
      : undefined;
  const selectedActionConfig = useMemo(
    () => destructionResultActions.find((action) => action.id === selectedAction),
    [selectedAction]
  );

  const tableRows = useMemo<ResultTableRow[]>(
    () =>
      sortedRows.map((row) => ({
        id: row.id,
        omschrijving: row.titel,
        vernietigingsstatus: row.vernietigingsstatus,
        stekker: row.bron_systeem ?? row.stekker,
      })),
    [sortedRows]
  );

  const executeSelectedAction = () => {
    if (!selectedRow || !selectedActionConfig) {
      return;
    }

    console.info("Actie uitgevoerd", selectedActionConfig.id, selectedRow.id);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isTyping =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key.toLowerCase() === "w" && selectedRow && selectedActionConfig) {
        event.preventDefault();
        executeSelectedAction();
      }

      if (event.key.toLowerCase() === "a" && previousRecord) {
        event.preventDefault();
        setSelectedId(previousRecord.id);
      }

      if (event.key.toLowerCase() === "d" && nextRecord) {
        event.preventDefault();
        setSelectedId(nextRecord.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextRecord, previousRecord, selectedActionConfig, selectedRow]);

  return (
    <>
      <AppShellPortal slot="detail">
        <RecordDetailsPanel
          heading="Record"
          record={{ titel: selectedRow?.titel ?? "Geen resultaat geselecteerd" }}
          comments={selectedContext?.comments ?? []}
          currentIndex={selectedIndex >= 0 ? selectedIndex + 1 : 0}
          totalCount={sortedRows.length}
          onPrevious={previousRecord ? () => setSelectedId(previousRecord.id) : undefined}
          onNext={nextRecord ? () => setSelectedId(nextRecord.id) : undefined}
          showTabs
          emptyCommentsMessage="Er zijn geen aanvullende opmerkingen voor dit resultaat."
          details={
            selectedRow
              ? [
                  {
                    label: "Omschrijving",
                    labelTitle: "Titel vernietigen informatieobjecten binnen de taak",
                    value: selectedRow.titel,
                    stacked: true,
                  },
                  {
                    label: "Code",
                    labelTitle:
                      "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.",
                    value: selectedRow.code ?? "-",
                  },
                  {
                    label: "Selectielijst",
                    labelTitle:
                      "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.",
                    value: selectedRow.selectielijst ?? "-",
                  },
                  {
                    label: "Grondslag",
                    labelTitle:
                      "De categorie/grondslag uit de vigerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden",
                    value: selectedRow.grondslag ?? "-",
                  },
                  {
                    label: "Bewaartermijn",
                    labelTitle:
                      "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst",
                    value:
                      selectedRow.bewaartermijn !== undefined
                        ? `${selectedRow.bewaartermijn} jaar`
                        : "-",
                  },
                  {
                    label: "Vernietigingsdatum",
                    labelTitle:
                      "Jaar en maand waarin het dossier/informatieobject vernietigd moest worden. Format: jjjj-mm",
                    value: selectedRow.vernietigingsdatum ?? "-",
                  },
                  {
                    label: "Periode",
                    labelTitle:
                      "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm",
                    value: `${selectedRow.startdatum ?? "-"} / ${selectedRow.einddatum ?? "-"}`,
                  },
                  {
                    label: "Vernietigingsstatus",
                    labelTitle: "Uitkomst van de uitgevoerde vernietigingsactie.",
                    value: getStatusLabel(selectedRow.vernietigingsstatus),
                    badgeClassName: getStatusBadgeClasses(selectedRow.vernietigingsstatus),
                  },
                  {
                    label: "Stekker",
                    labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.",
                    value: selectedRow.bron_systeem ?? selectedRow.stekker,
                  },
                  {
                    label: "Bron-ID",
                    labelTitle: "Identificatie van het informatieobject uit de stekker",
                    value: selectedRow.bron_id ?? "-",
                  },
                  {
                    label: "ID",
                    labelTitle: "Cockpit identificatienummer.",
                    value: selectedRow.id,
                  },
                  {
                    label: "Volgnummer",
                    labelTitle:
                      "Een nummer binnen de taak die voor vernietiging in aanmerking komen",
                    value: `${selectedIndex >= 0 ? selectedIndex + 1 : "-"}`,
                  },
                  {
                    label: "Omvang objecten",
                    labelTitle: "Aantal informatieobject",
                    value: `${selectedRow.omvang ?? 0}`,
                  },
                  {
                    label: "Omvang clienten",
                    labelTitle: "Aantal clienten behorende de informatieobjecten treft",
                    value: `${selectedRow.omvangClienten ?? "-"}`,
                  },
                  {
                    label: "Stekkermelding",
                    value: selectedRow.melding ?? "-",
                    stacked: true,
                  },
                ]
              : [
                  {
                    label: "Status",
                    value: "Geen resultaat beschikbaar.",
                    stacked: true,
                  },
                ]
          }
        />
      </AppShellPortal>

      <AppShellPortal slot="action">
        <ActionPanel
          embedded
          title="Actie"
          titleClassName="text-sm"
          hideHeaderBorder
          hideFooterBorder
          bodyPaddingYClass="py-0"
          footer={
            selectedRow ? (
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Actie uitvoeren"
                  variant="primary"
                  onClick={executeSelectedAction}
                />
              </ActionPanelButtonGroup>
            ) : null
          }
        >
          {!selectedRow ? (
            <ActionPanelEmptyState
              title="Kies eerst een resultaat"
              description="Na selectie tonen we hier de beschikbare uitvoeracties."
            />
          ) : (
            <ActionPanelSection title="Kies een actie">
              <div className="space-y-3">
                {destructionResultActions.map((action) => (
                  <ActionPanelChoice
                    key={action.id}
                    title={action.title}
                    description=""
                    icon={
                      action.id === "verklaring-downloaden" ? (
                        <Download size={18} />
                      ) : action.id === "resultaat-exporteren" ? (
                        <FileOutput size={18} />
                      ) : (
                        <Archive size={18} />
                      )
                    }
                    tone={action.tone}
                    density="compact"
                    selected={selectedAction === action.id}
                    onClick={() => setSelectedAction(action.id)}
                  />
                ))}
              </div>
            </ActionPanelSection>
          )}
        </ActionPanel>
      </AppShellPortal>

      <AppShellPortal slot="shortcut">
        <ShortcutPane
          shortcuts={[
            { keyLabel: "A", label: "Vorige" },
            { keyLabel: "D", label: "Volgende" },
            { keyLabel: "W", label: "Actie uitvoeren" },
          ]}
        />
      </AppShellPortal>

      <ContentPanel>
        <TaskExecutionHeader
          activeStep="RESULTAAT"
          summaryStats={resultSummaryStats}
          metaItems={resultTaskMetaItems}
          showStatusOverview={false}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ResultTable
            rows={tableRows}
            activeRecordId={selectedRow?.id ?? null}
            onActiveRecordChange={setSelectedId}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={(key, direction) => {
              setSortKey(key);
              setSortDirection(direction);
            }}
          />
        </div>
      </ContentPanel>
    </>
  );
}
