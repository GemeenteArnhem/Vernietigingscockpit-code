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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
  downloadVernietigingsverklaringPdf,
  downloadVernietigingsresultatenCsv,
  archiveerTaak,
  getArchivering,
  getDestructionResults,
  type ApiArchivering,
  getVernietigingsverklaring,
} from "../api/f3Data";
import { useSessionUser } from "../auth/useSessionUser";
import type {
  DestructionResultAction,
  DestructionResultActionOption,
  DestructionResultContext,
  DestructionResultRow,
  DestructionResultStatus,
} from "../shared/types/destructionResult";
import ActieFoutmelding from "../components/ActieFoutmelding";
import { AANTAL_OBJECTEN_UITLEG, AGGREGATIENIVEAU_UITLEG, ARCHIEFVORMER_UITLEG, WAARDERING_UITLEG } from "../features/task-execution/review/bulkDetails";

type ResultSortKey = "naam" | "resultaat" | "eventTijd";
// Kolommen die altijd zichtbaar zijn; de rest kiest de gebruiker in het kolommenmenu.
const VASTE_KOLOMMEN: ResultSortKey[] = ["naam", "resultaat"];
type ResultSortDirection = "asc" | "desc";
type SearchScope = "all" | "naam" | "resultaat";
type FacetFilterKey = "resultaat" | "stekker";
type ResultTableRow = {
  id: string;
  naam: string;
  resultaat: DestructionResultStatus;
  stekker: string;
  eventTijd: string;
};

const PAGE_SIZE = 100;

const EMPTY_SUMMARY_STATS = {
  teBeoordelen: 0,
  akkoord: 0,
  retour: 0,
  uitgesloten: 0,
};

// De verklaring maakt de worker automatisch bij de overgang naar resultaat (CC-17);
// er is geen knop meer om hem te genereren.
const RESULT_ACTIONS: DestructionResultActionOption[] = [
  {
    id: "verklaring-downloaden",
    title: "Verklaring downloaden",
    description: "Download de laatst gegenereerde verklaring.",
    tone: "primary",
  },
  {
    id: "resultaat-exporteren",
    title: "Resultaat exporteren",
    description: "Download de CSV-bijlage met alle vernietigingsresultaten.",
    tone: "neutral",
  },
  // Archiveren (CC-18): verklaring, CSV-bijlage en auditlog naar het archief; daarna is
  // de taak afgerond. Alleen zichtbaar als de API het toestaat.
  {
    id: "archiveren",
    title: "Archiveren",
    description: "Archiveer de verklaring, de CSV-bijlage en het auditlog en rond de taak af.",
    tone: "primary",
  },
];

const SEARCH_SCOPE_OPTIONS: Array<{ key: SearchScope; label: string }> = [
  { key: "all", label: "Alle kolommen" },
  { key: "naam", label: "Naam" },
  { key: "resultaat", label: "Vernietigingsstatus" },
];

const FILTER_LABELS: Record<FacetFilterKey, string> = {
  resultaat: "Vernietigingsstatus",
  stekker: "Stekker",
};

const COLUMN_LABELS: Record<ResultSortKey, string> = {
  naam: "Naam",
  resultaat: "Vernietigingsstatus",
  eventTijd: "Tijdstip vernietiging",
};

const COLUMN_TOOLTIPS: Record<ResultSortKey, string> = {
  naam: "Titel van het record binnen de resultaatlijst.",
  resultaat: "Uitkomst van de uitgevoerde vernietigingsactie.",
  eventTijd: "Tijdstip waarop de stekker het informatieobject heeft vernietigd (MDTO eventTijd).",
};

function getStatusLabel(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCESS":
      return "Succes";
    case "FAILED":
      return "Fout";
    case "NOT_FOUND":
      return "Niet gevonden";
    case "SKIPPED":
      return "Overgeslagen";
    case "CHANGED":
      return "Gewijzigd";
  }
}

function getStatusBadgeClasses(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "NOT_FOUND":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "SKIPPED":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "CHANGED":
      return "border-purple-200 bg-purple-50 text-purple-700";
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const [extraKolommen, setExtraKolommen] = useState<ResultSortKey[]>([]);
  const kolommen = [...VASTE_KOLOMMEN, ...extraKolommen];
  const [activeFilters, setActiveFilters] = useState<Partial<Record<FacetFilterKey, string>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const facetOptions = useMemo(
    () => ({
      resultaat: [
        "SUCCESS",
        "FAILED",
        "NOT_FOUND",
        "SKIPPED",
        "CHANGED",
      ].filter((status) =>
        rows.some((row) => row.resultaat === status)
      ),
      stekker: Array.from(new Set(rows.map((row) => row.stekker))).sort(),
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack =
        searchScope === "naam"
          ? row.naam
          : searchScope === "resultaat"
            ? getStatusLabel(row.resultaat)
            : `${row.naam} ${getStatusLabel(row.resultaat)}`;

      const matchesSearch = !query ? true : haystack.toLowerCase().includes(query);
      const matchesStatus =
        !activeFilters.resultaat
          ? true
          : row.resultaat === activeFilters.resultaat;
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
                          checked={kolommen.includes(column)}
                          readOnly={VASTE_KOLOMMEN.includes(column)}
                          onChange={() =>
                            VASTE_KOLOMMEN.includes(column)
                              ? undefined
                              : setExtraKolommen((huidig) =>
                                  huidig.includes(column) ? huidig.filter((kolom) => kolom !== column) : [...huidig, column]
                                )
                          }
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
                    {key === "resultaat"
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
                              {filterKey === "resultaat"
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
            {extraKolommen.includes("eventTijd") ? <col style={{ width: "184px" }} /> : null}
          </colgroup>
          <thead className="bg-white">
            <tr className="border-b border-slate-200">
              {kolommen.map((column) => (
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
                    {column === "resultaat" ? (
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
                      title={row.naam}
                    >
                      {row.naam}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-middle text-slate-700">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                        row.resultaat
                      )}`}
                    >
                      {getStatusLabel(row.resultaat)}
                    </span>
                  </td>
                  {extraKolommen.includes("eventTijd") ? (
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-700">{row.eventTijd}</td>
                  ) : null}
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
    "verklaring-downloaden"
  );
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ResultSortKey>("naam");
  const [sortDirection, setSortDirection] = useState<ResultSortDirection>("asc");
  const { id } = useParams();
  const { accessToken } = useSessionUser();
  const [apiRows, setApiRows] = useState<DestructionResultRow[] | null>(null);
  const [apiContexts, setApiContexts] = useState<DestructionResultContext[] | null>(null);
  const [apiSummaryStats, setApiSummaryStats] = useState(EMPTY_SUMMARY_STATS);
  const [apiMetaItems, setApiMetaItems] = useState<Array<{ label: string; value: string }>>([]);
  const [apiTaskName, setApiTaskName] = useState<string | null>(null);
  const [verklaringBeschikbaar, setVerklaringBeschikbaar] = useState(false);
  const [apiTaak, setApiTaak] = useState<{
    versie: number;
    toegestaneActies: string[];
    archivering: ApiArchivering | null;
  } | null>(null);
  const [herladen, setHerladen] = useState(0);
  const navigate = useNavigate();
  const collator = useMemo(
    () => new Intl.Collator("nl", { numeric: true, sensitivity: "base" }),
    []
  );

  useEffect(() => {
    if (!accessToken || !id) {
      return;
    }

    let isCurrent = true;

    getDestructionResults(accessToken, id)
      .then(({ taak, rows, contexts, summaryStats, metaItems }) => {
        if (!isCurrent) {
          return;
        }

        setApiRows(rows);
        setApiContexts(contexts);
        setApiSummaryStats(summaryStats);
        setApiMetaItems(metaItems);
        setApiTaskName(taak.naam);
        setApiTaak({
          versie: taak.versie,
          toegestaneActies: taak.toegestaneActies ?? [],
          archivering: taak.archivering ?? null,
        });
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        if (isCurrent) {
          setApiRows([]);
          setApiContexts(null);
          setApiSummaryStats(EMPTY_SUMMARY_STATS);
          setApiMetaItems([]);
          setApiTaskName(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, herladen, id]);

  // Zolang de worker de verklaring nog maakt: elke paar seconden kijken of hij er is.
  useEffect(() => {
    if (!accessToken || !id || verklaringBeschikbaar) {
      return;
    }

    let isCurrent = true;
    const controleer = () => {
      getVernietigingsverklaring(accessToken, id)
        .then((verklaring) => {
          if (isCurrent && verklaring.beschikbaar) {
            setVerklaringBeschikbaar(true);
            // Met de verklaring kan ook archiveren: de taakgegevens opnieuw ophalen.
            setHerladen((teller) => teller + 1);
          }
        })
        .catch(() => undefined);
    };

    controleer();
    const interval = window.setInterval(controleer, 3000);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
    };
  }, [accessToken, id, verklaringBeschikbaar]);

  const resultRows = useMemo(() => apiRows ?? [], [apiRows]);
  const contextById = useMemo<Record<string, DestructionResultContext>>(
    () =>
      Object.fromEntries(
        (apiContexts ?? []).map((context) => [
          context.recordId,
          context,
        ])
      ),
    [apiContexts]
  );

  const sortedRows = useMemo(
    () =>
      [...resultRows].sort((left, right) => {
        // Tijdstip: op de ISO-waarde, zodat de volgorde chronologisch is.
        const waarde = (row: DestructionResultRow) =>
          sortKey === "naam" ? row.naam : sortKey === "eventTijd" ? (row.eventTijdIso ?? "") : getStatusLabel(row.resultaat);
        const leftValue = waarde(left);
        const rightValue = waarde(right);
        const comparison = collator.compare(String(leftValue), String(rightValue));

        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [collator, resultRows, sortDirection, sortKey]
  );

  const activeSelectedId = useMemo(
    () =>
      sortedRows.some((row) => row.id === selectedId)
        ? selectedId
        : sortedRows[0]?.id ?? null,
    [selectedId, sortedRows]
  );

  const selectedIndex = useMemo(
    () => sortedRows.findIndex((row) => row.id === activeSelectedId),
    [activeSelectedId, sortedRows]
  );
  const selectedRow = useMemo(
    () => sortedRows.find((row) => row.id === activeSelectedId) ?? sortedRows[0],
    [activeSelectedId, sortedRows]
  );
  const selectedContext = selectedRow ? contextById[selectedRow.id] : undefined;
  const previousRecord = selectedIndex > 0 ? sortedRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < sortedRows.length - 1
      ? sortedRows[selectedIndex + 1]
      : undefined;
  const visibleActions = useMemo(
    () =>
      RESULT_ACTIONS.filter((action) => {
        if (action.id === "archiveren") {
          return apiTaak?.toegestaneActies.includes("archiveren") ?? false;
        }

        return verklaringBeschikbaar;
      }).map((action) =>
        action.id === "archiveren" && apiTaak?.archivering?.status === "FAILED"
          ? { ...action, title: "Opnieuw archiveren" }
          : action
      ),
    [apiTaak, verklaringBeschikbaar]
  );
  const selectedActionConfig = useMemo(
    () =>
      visibleActions.find((action) => action.id === selectedAction) ??
      visibleActions[0],
    [selectedAction, visibleActions]
  );

  const tableRows = useMemo<ResultTableRow[]>(
    () =>
      sortedRows.map((row) => ({
        id: row.id,
        naam: row.naam,
        resultaat: row.resultaat,
        stekker: row.stekker,
        eventTijd: row.eventTijd ?? "-",
      })),
    [sortedRows]
  );

  const executeSelectedAction = useCallback(async () => {
    if (!selectedRow || !selectedActionConfig) {
      return;
    }

    if (!accessToken || !id) {
      setActionError("Download kan pas nadat de taak via de API is geladen.");
      return;
    }

    setActionError(null);
    setIsExecutingAction(true);

    try {
      if (selectedActionConfig.id === "archiveren") {
        if (!apiTaak) {
          throw new Error("Archiveren kan pas nadat de taak via de API is geladen.");
        }

        // De worker archiveert; wachten tot het gelukt of mislukt is.
        await archiveerTaak(accessToken, id, apiTaak.versie);
        let stand = await getArchivering(accessToken, id);
        for (let poging = 0; poging < 60 && stand.archivering?.status === "PENDING"; poging += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          stand = await getArchivering(accessToken, id);
        }

        if (stand.archivering?.status === "SUCCESS") {
          navigate("/dashboard");
          return;
        }

        setHerladen((teller) => teller + 1);
        throw new Error(
          stand.archivering?.status === "FAILED"
            ? `Archiveren is mislukt: ${stand.archivering.fout ?? "onbekende fout"}`
            : "Archiveren duurt langer dan verwacht; ververs de pagina later."
        );
      } else if (selectedActionConfig.id === "resultaat-exporteren") {
        const download = await downloadVernietigingsresultatenCsv(accessToken, id);

        downloadBlob(
          download.blob,
          download.filename ?? `vernietigingsresultaten-${id}.csv`
        );
      } else if (selectedActionConfig.id === "verklaring-downloaden") {
        const download = await downloadVernietigingsverklaringPdf(accessToken, id);

        downloadBlob(
          download.blob,
          download.filename ?? `vernietigingsverklaring-${id}.pdf`
        );
      } else {
        console.info("Actie uitgevoerd", selectedActionConfig.id, selectedRow.id);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Actie uitvoeren is mislukt."
      );
    } finally {
      setIsExecutingAction(false);
    }
  }, [accessToken, apiTaak, id, navigate, selectedActionConfig, selectedRow]);

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
        void executeSelectedAction();
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
  }, [executeSelectedAction, nextRecord, previousRecord, selectedActionConfig, selectedRow]);

  return (
    <>
      <AppShellPortal slot="detail">
        <RecordDetailsPanel
          heading="Record"
          record={{ naam: selectedRow?.naam ?? "Geen resultaat geselecteerd" }}
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
                    label: "Naam",
                    labelTitle: "Naam van het informatieobject",
                    value: selectedRow.naam,
                    stacked: true,
                  },
                  {
                    label: "Aggregatieniveau",
                    labelTitle: AGGREGATIENIVEAU_UITLEG,
                    value: selectedRow.aggregatieniveau ?? "-",
                  },
                  {
                    label: "Waardering",
                    labelTitle: WAARDERING_UITLEG,
                    value: selectedRow.waardering ?? "-",
                  },
                  {
                    label: "Classificatie",
                    labelTitle:
                      "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.",
                    value: selectedRow.classificatie ?? "-",
                  },
                  {
                    label: "Selectielijst",
                    labelTitle:
                      "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.",
                    value: selectedRow.selectielijst ?? "-",
                  },
                  {
                    label: "Informatiecategorie",
                    labelTitle:
                      "De categorie/grondslag uit de vigerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden",
                    value: selectedRow.informatiecategorie ?? "-",
                  },
                  {
                    label: "Bewaartermijn",
                    labelTitle:
                      "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst",
                    value:
                      selectedRow.termijnLooptijd !== undefined
                        ? selectedRow.termijnLooptijd
                        : "-",
                  },
                  {
                    label: "Einddatum bewaartermijn",
                    labelTitle:
                      "Jaar en maand waarin het dossier/informatieobject vernietigd moest worden. Format: jjjj-mm",
                    value: selectedRow.termijnEinddatum ?? "-",
                  },
                  {
                    label: "Dekking in tijd",
                    labelTitle:
                      "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm",
                    value: `${selectedRow.dekkingInTijdBegindatum ?? "-"} / ${selectedRow.dekkingInTijdEinddatum ?? "-"}`,
                  },
                  {
                    label: "Vernietigingsstatus",
                    labelTitle: "Uitkomst van de uitgevoerde vernietigingsactie.",
                    value: getStatusLabel(selectedRow.resultaat),
                    badgeClassName: getStatusBadgeClasses(selectedRow.resultaat),
                  },
                  {
                    label: "Stekker",
                    labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.",
                    value: selectedRow.stekker,
                  },
                  {
                    label: "Identificatie",
                    labelTitle: "Identificatie van het informatieobject: kenmerk en bron (MDTO identificatie)",
                    value: selectedRow.identificaties?.join("\n") || (selectedRow.identificatie ?? "-"),
                  },
                  {
                    label: "Archiefvormer",
                    labelTitle: ARCHIEFVORMER_UITLEG,
                    value: selectedRow.archiefvormer ?? "-",
                  },
                  {
                    label: "Tijdstip vernietiging",
                    labelTitle: "Tijdstip waarop de stekker het informatieobject heeft vernietigd (MDTO eventTijd).",
                    value: selectedRow.eventTijd ?? "-",
                  },
                  {
                    label: "Vernietigingsmethode",
                    labelTitle: "Wijze van vernietiging volgens de stekker.",
                    value: selectedRow.vernietigingsmethode ?? "-",
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
                    label: "Aantal objecten",
                    labelTitle: AANTAL_OBJECTEN_UITLEG,
                    value: `${selectedRow.omvang ?? 0}`,
                  },
                  {
                    label: "Aantal betrokkenen",
                    labelTitle: "Aantal betrokkenen",
                    value: `${selectedRow.aantalBetrokkenen ?? "-"}`,
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
                  label={isExecutingAction ? "Bezig..." : "Actie uitvoeren"}
                  variant="primary"
                  disabled={isExecutingAction}
                  onClick={() => {
                    void executeSelectedAction();
                  }}
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
                {visibleActions.map((action) => (
                  <ActionPanelChoice
                    key={action.id}
                    title={action.title}
                    description={action.description}
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

                <ActieFoutmelding melding={actionError} />
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
          title={apiTaskName ?? undefined}
          activeStep="RESULTAAT"
          summaryStats={apiSummaryStats}
          metaItems={apiMetaItems}
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
