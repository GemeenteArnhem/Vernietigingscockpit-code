import {
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  FileText,
  FolderArchive,
  Info,
  ListFilter,
  MessageSquareMore,
  MoreHorizontal,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
} from "../../../../components/ContentPanel";
import RecordCommentsSection from "../../components/RecordCommentsSection";
import RecordDetailsSection from "../../components/RecordDetailsSection";
import { AANTAL_OBJECTEN_UITLEG } from "../bulkDetails";
import TaskExecutionHeader from "../../components/TaskExecutionHeader";
import type { VernietigingsKandidaat } from "../../../../shared/types/destruction";
import { getReviewQueueStatusStyle } from "../../../../shared/ui/reviewStatusStyles";
import type {
  ReviewQueueStatus,
  ReviewRecordContext,
} from "../../../../shared/types/review";

type ReviewRecordPanelSummaryStats = {
  teBeoordelen: number;
  akkoord: number;
  retour: number;
  uitgesloten: number;
};

type ReviewRecordTableRow = {
  id: string;
  naam: string;
  queueStatus: ReviewQueueStatus;
  volgnummer: number;
  classificatie: string;
  selectielijst: string;
  informatiecategorie: string;
  termijnLooptijd: string;
  termijnEinddatum: string;
  opmerkingenCount: number;
  aantalObjecten: string;
  aantalBetrokkenen: string;
  dekkingInTijd: string;
  stekker: string;
  identificatie: string;
  aggregatieniveau: string;
  waardering: string;
};

export type { ReviewRecordTableRow };

type TableColumnKey =
  | "naam"
  | "status"
  | "volgnummer"
  | "classificatie"
  | "selectielijst"
  | "informatiecategorie"
  | "termijnLooptijd"
  | "termijnEinddatum"
  | "opmerking"
  | "aantalObjecten"
  | "aantalBetrokkenen"
  | "dekkingInTijd"
  | "stekker"
  | "identificatie"
  | "aggregatieniveau"
  | "waardering";

export type ReviewRecordSortKey = TableColumnKey;
export type ReviewRecordSortDirection = "asc" | "desc";

export type SearchScope = "all" | "naam" | "classificatie" | "termijnEinddatum" | "identificatie";

export type FacetFilterKey = "status" | "selectielijst" | "stekker" | "termijnLooptijd";

export type FacetOptie = { waarde: string; label: string };

// Server-gestuurde lijst (CC-10): zoeken, filteren, sorteren en pagineren gebeurt op de
// server; de tabel toont alleen de geladen pagina. Zonder deze prop werkt de tabel zoals
// voorheen volledig in de browser. Het uiterlijk is in beide gevallen gelijk.
export type ServerLijst = {
  totaal: number;
  pagina: number;
  paginaGrootte: number;
  zoek: string;
  zoekIn: SearchScope;
  filters: Partial<Record<FacetFilterKey, string>>;
  facetOpties: Record<FacetFilterKey, FacetOptie[]>;
  onPaginaChange: (pagina: number) => void;
  onZoekChange: (zoek: string, zoekIn: SearchScope) => void;
  onFiltersChange: (filters: Partial<Record<FacetFilterKey, string>>) => void;
  // Alle id's die aan de huidige zoekopdracht en filters voldoen.
  gefilterdeIds: () => Promise<string[]>;
};

type Props = {
  record?: VernietigingsKandidaat;
  context?: ReviewRecordContext;
  queueStatus?: ReviewQueueStatus;
  currentIndex?: number;
  totalCount?: number;
  activeStep?: string;
  showRecordSections?: boolean;
  summaryStats?: ReviewRecordPanelSummaryStats;
  reviewTableRows?: ReviewRecordTableRow[];
  selectedTableIds?: string[];
  onSelectedTableIdsChange?: (ids: string[]) => void;
  activeRecordId?: string | null;
  onActiveRecordChange?: (id: string) => void;
  sortKey?: ReviewRecordSortKey;
  sortDirection?: ReviewRecordSortDirection;
  onSortChange?: (key: ReviewRecordSortKey, direction: ReviewRecordSortDirection) => void;
  enableCrossPageBulkSelection?: boolean;
  server?: ServerLijst;
  onPrevious?: () => void;
  onNext?: () => void;
};

const PAGE_SIZE = 100;

function getQueueIcon(queueStatus: ReviewQueueStatus) {
  const style = getReviewQueueStatusStyle(queueStatus);

  if (queueStatus === "afgerond") {
    return {
      icon: <ShieldCheck size={15} className="text-current" />,
      className: style.iconBadge,
    };
  }

  if (queueStatus === "conflict") {
    return {
      icon: <ShieldAlert size={15} className="text-current" />,
      className: style.iconBadge,
    };
  }

  return {
    icon: <FileText size={15} className="text-current" />,
    className: style.iconBadge,
  };
}

function getQueueStatusLabel(queueStatus: ReviewQueueStatus) {
  switch (queueStatus) {
    case "afgerond":
      return "Akkoord";
    case "retour":
      return "Retour";
    case "conflict":
      return "Uitgesloten";
    case "uitgesteld":
      return "Uitgesteld";
    default:
      return "Te beoordelen";
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

const DEFAULT_VISIBLE_COLUMNS: TableColumnKey[] = [
  "naam",
  "status",
  "volgnummer",
  "classificatie",
  "selectielijst",
  "informatiecategorie",
  "termijnLooptijd",
  "termijnEinddatum",
  "opmerking",
];

const COLUMN_LABELS: Record<TableColumnKey, string> = {
  naam: "Naam",
  status: "Status",
  volgnummer: "Nr.",
  classificatie: "Classificatie",
  selectielijst: "Selectielijst",
  informatiecategorie: "Informatiecategorie",
  termijnLooptijd: "Termijn",
  termijnEinddatum: "Einddatum bewaartermijn",
  opmerking: "Opmerking",
  aantalObjecten: "Aantal objecten",
  aantalBetrokkenen: "Aantal betrokkenen",
  dekkingInTijd: "Dekking in tijd",
  stekker: "Stekker",
  identificatie: "Identificatie",
  aggregatieniveau: "Aggregatieniveau",
  waardering: "Waardering",
};

const COLUMN_TOOLTIPS: Record<TableColumnKey, string> = {
  naam: "Naam van het informatieobject",
  status: "Status van beoordeling: Akkoord, Retour, Uitgesloten, Uitgesteld",
  volgnummer: "Een nummer binnen de taak die voor vernietiging in aanmerking komen",
  classificatie: "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.",
  selectielijst: "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.",
  informatiecategorie: "De categorie/grondslag uit de vignerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden",
  termijnLooptijd: "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst",
  termijnEinddatum: "Jaar en maand waarin de bewaartermijn eindigt (MDTO termijnEinddatum). Format: jjjj-mm",
  opmerking: "Patel groen rondje met aantal opmerkingen. indien er geen opmerkingen zijn, leeg.",
  aantalObjecten: AANTAL_OBJECTEN_UITLEG,
  aantalBetrokkenen: "Aantal betrokkenen",
  dekkingInTijd: "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm",
  stekker: "Naam van de stekker waar de informatieobjecten uit komt.",
  identificatie: "Identificatie van het informatieobject uit de stekker",
  aggregatieniveau: "Niveau van het informatieobject volgens MDTO: Archief, Serie, Dossier of Archiefstuk.",
  waardering: "Waardering volgens de selectielijst (MDTO): alleen Tijdelijk te bewaren komt in aanmerking voor vernietiging.",
};

const COLUMN_WIDTHS: Partial<Record<TableColumnKey, string>> = {
  status: "64px",
  opmerking: "72px",
  volgnummer: "96px",
  classificatie: "120px",
  selectielijst: "120px",
  informatiecategorie: "220px",
  termijnLooptijd: "132px",
  termijnEinddatum: "148px",
  aantalObjecten: "132px",
  aantalBetrokkenen: "132px",
  dekkingInTijd: "168px",
  stekker: "160px",
  identificatie: "160px",
  aggregatieniveau: "140px",
  waardering: "180px",
};

const SEARCH_SCOPE_OPTIONS: Array<{ key: SearchScope; label: string }> = [
  { key: "all", label: "Alle kolommen" },
  { key: "naam", label: "Naam" },
  { key: "classificatie", label: "Classificatie" },
  { key: "termijnEinddatum", label: "Einddatum bewaartermijn" },
  { key: "identificatie", label: "Identificatie" },
];

const FACET_FILTER_LABELS: Record<FacetFilterKey, string> = {
  status: "Status",
  selectielijst: "Selectielijst",
  stekker: "Stekker",
  termijnLooptijd: "Termijn",
};

function ReviewChunkedTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  activeRecordId,
  onActiveRecordChange,
  sortKey = "termijnEinddatum",
  sortDirection = "asc",
  onSortChange,
  enableCrossPageBulkSelection = false,
  server,
}: {
  rows: ReviewRecordTableRow[];
  selectedIds: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  activeRecordId?: string | null;
  onActiveRecordChange?: (id: string) => void;
  sortKey?: ReviewRecordSortKey;
  sortDirection?: ReviewRecordSortDirection;
  onSortChange?: (key: ReviewRecordSortKey, direction: ReviewRecordSortDirection) => void;
  enableCrossPageBulkSelection?: boolean;
  server?: ServerLijst;
}) {
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [searchScopeOpen, setSearchScopeOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] =
    useState<TableColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [activeFilters, setActiveFilters] = useState<Partial<Record<FacetFilterKey, string>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // In server-modus komen zoekterm, zoekkolom, filters en pagina uit `server`.
  const zoekWaarde = server ? server.zoek : search;
  const zoekScope = server ? server.zoekIn : searchScope;
  const filters = server ? server.filters : activeFilters;
  const pagina = server ? server.pagina : currentPage;
  const paginaGrootte = server ? server.paginaGrootte : PAGE_SIZE;

  const facetOptions = useMemo<Record<FacetFilterKey, FacetOptie[]>>(() => {
    if (server) {
      return server.facetOpties;
    }

    const opties = (waarden: string[]) => waarden.map((waarde) => ({ waarde, label: waarde }));

    return {
      status: [
        "nog-te-beoordelen",
        "afgerond",
        "retour",
        "conflict",
        "uitgesteld",
      ]
        .filter((status) => rows.some((row) => row.queueStatus === status))
        .map((status) => ({ waarde: status, label: getQueueStatusLabel(status as ReviewQueueStatus) })),
      selectielijst: opties(Array.from(new Set(rows.map((row) => row.selectielijst))).sort()),
      stekker: opties(Array.from(new Set(rows.map((row) => row.stekker))).sort()),
      termijnLooptijd: opties(Array.from(new Set(rows.map((row) => row.termijnLooptijd))).sort()),
    };
  }, [rows, server]);

  const facetLabel = (key: FacetFilterKey, waarde: string) =>
    facetOptions[key].find((optie) => optie.waarde === waarde)?.label ??
    (key === "status" ? getQueueStatusLabel(waarde as ReviewQueueStatus) : waarde);

  const searchScopeLabel =
    SEARCH_SCOPE_OPTIONS.find((option) => option.key === zoekScope)?.label ?? "Alle kolommen";

  const filteredRows = useMemo(() => {
    if (server) {
      return rows;
    }

    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query
        ? true
        : (() => {
            const haystack =
              searchScope === "naam"
                ? row.naam
                : searchScope === "classificatie"
                  ? row.classificatie
                  : searchScope === "termijnEinddatum"
                    ? row.termijnEinddatum
                    : searchScope === "identificatie"
                      ? row.identificatie
                      : [row.naam, row.classificatie, row.termijnEinddatum, row.identificatie].join(" ");

            return haystack.toLowerCase().includes(query);
          })();

      const matchesFilters =
        (!activeFilters.status || row.queueStatus === activeFilters.status) &&
        (!activeFilters.selectielijst || row.selectielijst === activeFilters.selectielijst) &&
        (!activeFilters.stekker || row.stekker === activeFilters.stekker) &&
        (!activeFilters.termijnLooptijd || row.termijnLooptijd === activeFilters.termijnLooptijd);

      return matchesSearch && matchesFilters;
    });
  }, [activeFilters, rows, search, searchScope, server]);

  const totaalGefilterd = server ? server.totaal : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totaalGefilterd / paginaGrootte));
  const safePage = Math.min(pagina, totalPages - 1);
  const pageStart = safePage * paginaGrootte;
  const pageEnd = server
    ? pageStart + rows.length
    : Math.min(pageStart + paginaGrootte, filteredRows.length);
  const visibleRows = server ? rows : filteredRows.slice(pageStart, pageEnd);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = safePage < totalPages - 1;
  const paginationItems = getPaginationItems(totalPages, safePage);
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const allFilteredSelected = server
    ? allVisibleSelected && selectedIds.length >= server.totaal
    : filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));
  const selectedVisibleCount = visibleRows.filter((row) => selectedIds.includes(row.id)).length;

  const orderedColumns = ([
    "naam",
    "status",
    "volgnummer",
    "classificatie",
    "selectielijst",
    "informatiecategorie",
    "termijnLooptijd",
    "termijnEinddatum",
    "opmerking",
    "aantalObjecten",
    "aantalBetrokkenen",
    "dekkingInTijd",
    "stekker",
    "identificatie",
    "aggregatieniveau",
    "waardering",
  ] as TableColumnKey[]).filter((column) => visibleColumns.includes(column));

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = 0;
  }, [safePage, zoekWaarde, filters, zoekScope]);

  const toggleRow = (id: string) => {
    if (!onSelectedIdsChange) {
      return;
    }

    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((currentId) => currentId !== id)
        : [...selectedIds, id]
    );
  };

  const toggleVisibleRows = () => {
    if (!onSelectedIdsChange) {
      return;
    }

    if (allVisibleSelected) {
      onSelectedIdsChange(
        selectedIds.filter((id) => !visibleRows.some((row) => row.id === id))
      );
      return;
    }

    onSelectedIdsChange(
      Array.from(new Set([...selectedIds, ...visibleRows.map((row) => row.id)]))
    );
  };

  const selectAllFilteredRows = async () => {
    if (!onSelectedIdsChange) {
      return;
    }

    const ids = server ? await server.gefilterdeIds() : filteredRows.map((row) => row.id);
    onSelectedIdsChange(Array.from(new Set([...selectedIds, ...ids])));
  };

  const clearFilteredSelection = async () => {
    if (!onSelectedIdsChange) {
      return;
    }

    const ids = new Set(server ? await server.gefilterdeIds() : filteredRows.map((row) => row.id));
    onSelectedIdsChange(selectedIds.filter((id) => !ids.has(id)));
  };

  const zetPagina = (volgende: number) => {
    if (server) {
      server.onPaginaChange(volgende);
    } else {
      setCurrentPage(volgende);
    }
  };

  const zetZoek = (zoek: string, scope: SearchScope) => {
    if (server) {
      server.onZoekChange(zoek, scope);
      return;
    }

    setSearch(zoek);
    setSearchScope(scope);
    setCurrentPage(0);
  };

  const zetFilters = (volgende: Partial<Record<FacetFilterKey, string>>) => {
    if (server) {
      server.onFiltersChange(volgende);
      return;
    }

    setActiveFilters(volgende);
    setCurrentPage(0);
  };

  const toggleColumn = (column: TableColumnKey) => {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== column);
      }

      const next = [...current, column];
      const orderedKeys = [
        "naam",
        "status",
        "volgnummer",
        "classificatie",
        "selectielijst",
        "informatiecategorie",
        "termijnLooptijd",
        "termijnEinddatum",
        "opmerking",
        "aantalObjecten",
        "aantalBetrokkenen",
        "dekkingInTijd",
        "stekker",
        "identificatie",
        "aggregatieniveau",
        "waardering",
      ] as TableColumnKey[];

      return orderedKeys.filter((item) => next.includes(item));
    });
  };

  const toggleSort = (column: ReviewRecordSortKey) => {
    const nextDirection =
      sortKey === column && sortDirection === "asc" ? "desc" : "asc";
    onSortChange?.(column, nextDirection);
    if (!server) {
      setCurrentPage(0);
    }
  };

  const setFacetFilter = (key: FacetFilterKey, value: string) => {
    zetFilters({ ...filters, [key]: value });
    setFilterMenuOpen(false);
  };

  const clearFacetFilter = (key: FacetFilterKey) => {
    const next = { ...filters };
    delete next[key];
    zetFilters(next);
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
                  value={zoekWaarde}
                  onChange={(event) => zetZoek(event.target.value, zoekScope)}
                  placeholder="Zoek op naam, classificatie of einddatum bewaartermijn..."
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
                              zetZoek(zoekWaarde, option.key);
                              setSearchScopeOpen(false);
                            }}
                            className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition ${
                              zoekScope === option.key
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
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Weergave kolommen
                  </div>
                  <div className="space-y-1.5">
                    {(Object.keys(COLUMN_LABELS) as TableColumnKey[]).map((column) => (
                      <label
                        key={column}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        title={COLUMN_TOOLTIPS[column]}
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(column)}
                          onChange={() => toggleColumn(column)}
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
                disabled={selectedIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MoreHorizontal size={16} />
                Acties
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
            {Object.entries(filters).map(([key, value]) => (
              <span
                key={`${key}-${value}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
              >
                <span className="font-medium text-slate-500">
                  {FACET_FILTER_LABELS[key as FacetFilterKey]}:
                </span>
                <span>{facetLabel(key as FacetFilterKey, value)}</span>
                <button
                  type="button"
                  onClick={() => clearFacetFilter(key as FacetFilterKey)}
                  className="text-slate-400 transition hover:text-slate-700"
                  aria-label={`Verwijder filter ${FACET_FILTER_LABELS[key as FacetFilterKey]}`}
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
                <div className="absolute right-0 top-full z-20 mt-2 w-[360px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Filters
                  </div>
                  <div className="space-y-3">
                    {(Object.keys(FACET_FILTER_LABELS) as FacetFilterKey[]).map((filterKey) => (
                      <div key={filterKey}>
                        <div className="mb-1 text-sm font-medium text-slate-700">
                          {FACET_FILTER_LABELS[filterKey]}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {facetOptions[filterKey].map((option) => (
                            <button
                              key={`${filterKey}-${option.waarde}`}
                              type="button"
                              onClick={() => setFacetFilter(filterKey, option.waarde)}
                              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                filters[filterKey] === option.waarde
                                  ? "border-blue-600 bg-blue-50 text-blue-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {option.label}
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

          {enableCrossPageBulkSelection && allVisibleSelected && totaalGefilterd > visibleRows.length ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {!allFilteredSelected ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {selectedVisibleCount.toLocaleString("nl-NL")} records op deze pagina geselecteerd.
                  </span>
                  <button
                    type="button"
                    onClick={() => void selectAllFilteredRows()}
                    className="font-medium text-sky-800 underline underline-offset-2 hover:text-sky-900"
                  >
                    Selecteer ook alle {totaalGefilterd.toLocaleString("nl-NL")} gefilterde records
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    Alle {totaalGefilterd.toLocaleString("nl-NL")} gefilterde records zijn geselecteerd.
                  </span>
                  <button
                    type="button"
                    onClick={() => void clearFilteredSelection()}
                    className="font-medium text-sky-800 underline underline-offset-2 hover:text-sky-900"
                  >
                    Selectie binnen filter wissen
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto"
      >
        <table className="min-w-full table-auto text-sm">
          <colgroup>
            <col style={{ width: "48px" }} />
            {orderedColumns.map((column) => (
              <col
                key={`col-${column}`}
                style={COLUMN_WIDTHS[column] ? { width: COLUMN_WIDTHS[column] } : undefined}
              />
            ))}
          </colgroup>
          <thead className="bg-white">
            <tr className="border-b border-slate-200">
              <th className="sticky top-0 z-10 w-12 bg-white px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleRows}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Selecteer zichtbare records"
                />
              </th>
              {orderedColumns.map((column) => (
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
                  className={`sticky top-0 z-10 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${
                    column === "naam"
                      ? "text-left"
                      : column === "status" || column === "opmerking"
                        ? "text-center"
                        : column === "informatiecategorie"
                          ? "text-left"
                          : column === "dekkingInTijd"
                            ? "text-left"
                            : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column)}
                    className={`inline-flex w-full items-center gap-1.5 rounded-sm text-inherit outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                      column === "status" || column === "opmerking"
                        ? "justify-center"
                        : "justify-start"
                    }`}
                    aria-label={`Sorteer op ${COLUMN_LABELS[column]}`}
                  >
                    {column === "status" ? (
                      <span className="inline-flex items-center justify-center text-slate-400">
                        <Info size={14} />
                      </span>
                    ) : column === "opmerking" ? (
                      <span className="inline-flex items-center justify-center text-slate-400">
                        <MessageSquareMore size={14} />
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
              const isSelected = selectedIds.includes(row.id);
              const queueIcon = getQueueIcon(row.queueStatus);

              return (
                <tr
                  key={row.id}
                  onClick={() => onActiveRecordChange?.(row.id)}
                  className={`border-b border-slate-100 transition hover:bg-slate-50 ${
                    isActive ? "bg-blue-50/50" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Selecteer ${row.naam}`}
                    />
                  </td>
                  {orderedColumns.map((column) => (
                    <td
                      key={`${row.id}-${column}`}
                      className={`px-4 py-3 align-middle text-slate-700 ${
                        column === "naam"
                          ? "text-left"
                          : column === "opmerking" || column === "status"
                            ? "text-center"
                            : ""
                      }`}
                    >
                      {column === "naam" ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onActiveRecordChange?.(row.id);
                          }}
                          className="truncate text-left font-medium text-slate-900 hover:text-blue-700"
                          title={row.naam}
                        >
                          {row.naam}
                        </button>
                      ) : column === "status" ? (
                        <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${queueIcon.className}`}>
                          {queueIcon.icon}
                        </div>
                      ) : column === "opmerking" ? (
                        row.opmerkingenCount > 0 ? (
                          <span
                            className="text-sm font-medium text-slate-700"
                            title={`${row.opmerkingenCount} opmerking${row.opmerkingenCount === 1 ? "" : "en"}`}
                          >
                            {row.opmerkingenCount}
                          </span>
                        ) : null
                      ) : column === "volgnummer" ? (
                        row.volgnummer.toLocaleString("nl-NL")
                      ) : column === "classificatie" ? (
                        row.classificatie
                      ) : column === "selectielijst" ? (
                        row.selectielijst
                      ) : column === "informatiecategorie" ? (
                        row.informatiecategorie
                      ) : column === "termijnLooptijd" ? (
                        row.termijnLooptijd
                      ) : column === "termijnEinddatum" ? (
                        row.termijnEinddatum
                      ) : column === "aantalObjecten" ? (
                        row.aantalObjecten
                      ) : column === "aantalBetrokkenen" ? (
                        row.aantalBetrokkenen
                      ) : column === "dekkingInTijd" ? (
                        row.dekkingInTijd
                      ) : column === "stekker" ? (
                        row.stekker
                      ) : column === "aggregatieniveau" ? (
                        row.aggregatieniveau
                      ) : column === "waardering" ? (
                        row.waardering
                      ) : (
                        row.identificatie
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-2 text-sm text-slate-500">
        <div className="whitespace-nowrap">
          {totaalGefilterd === 0
            ? "0 records"
            : `${(pageStart + 1).toLocaleString("nl-NL")}-${pageEnd.toLocaleString("nl-NL")} van ${totaalGefilterd.toLocaleString("nl-NL")} records`}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zetPagina(Math.max(safePage - 1, 0))}
            disabled={!hasPreviousPage}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Vorige pagina"
          >
            <ChevronLeft size={14} />
          </button>

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
                onClick={() => zetPagina(item)}
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

          <button
            type="button"
            onClick={() => zetPagina(Math.min(safePage + 1, totalPages - 1))}
            disabled={!hasNextPage}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Volgende pagina"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function ReviewRecordPanel({
  record,
  context,
  activeStep = "BEOORDELING",
  showRecordSections = true,
  summaryStats,
  reviewTableRows,
  selectedTableIds = [],
  onSelectedTableIdsChange,
  activeRecordId,
  onActiveRecordChange,
  sortKey,
  sortDirection,
  onSortChange,
  enableCrossPageBulkSelection = false,
  server,
}: Props) {
  if (!record || !context) {
    return (
      <ContentPanel>
        <ContentPanelEmptyState
          icon={<FolderArchive size={24} />}
          title="Kies een record uit de lijst"
          description="Na selectie tonen we hier de taakcontext en recorddetails."
        />
      </ContentPanel>
    );
  }
  const taskMetaItems = [
    { label: "Recordmanager", value: context.recordmanager, icon: <User size={18} strokeWidth={1.8} /> },
    { label: "Eigenaar", value: context.proceseigenaar, icon: <Building2 size={18} strokeWidth={1.8} /> },
    { label: "Archivaris", value: context.archivaris },
    { label: "Startdatum", value: context.startdatumTaak, icon: <CalendarDays size={18} strokeWidth={1.8} /> },
  ];
  taskMetaItems[2] = {
    label: "Archivaris",
    value: context.archivaris,
    icon: <User size={18} strokeWidth={1.8} />,
  };
  const stats = summaryStats ?? {
    teBeoordelen: 24,
    akkoord: 156,
    retour: 8,
    uitgesloten: 3,
  };
  const tableRows = reviewTableRows ?? [];
  const hasChunkedTable = tableRows.length > 0;

  return (
    <ContentPanel>
      <TaskExecutionHeader
        title={context.proces}
        activeStep={activeStep}
        summaryStats={stats}
        metaItems={taskMetaItems}
      />

      {hasChunkedTable && !showRecordSections ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ReviewChunkedTable
            rows={tableRows}
            selectedIds={selectedTableIds}
            onSelectedIdsChange={onSelectedTableIdsChange}
            activeRecordId={activeRecordId}
            onActiveRecordChange={onActiveRecordChange}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            enableCrossPageBulkSelection={enableCrossPageBulkSelection}
            server={server}
          />
        </div>
      ) : (
        <ContentPanelBody className="flex min-h-0 flex-1 flex-col">
          {reviewTableRows && reviewTableRows.length > 0 && (
            <ReviewChunkedTable
            rows={tableRows}
            selectedIds={selectedTableIds}
            onSelectedIdsChange={onSelectedTableIdsChange}
            activeRecordId={activeRecordId}
            onActiveRecordChange={onActiveRecordChange}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            enableCrossPageBulkSelection={enableCrossPageBulkSelection}
            server={server}
          />
          )}

          {showRecordSections && (
            <>
              <RecordDetailsSection
                record={record}
                vernietigbaarSinds={context.vernietigbaarSinds}
              />

              <RecordCommentsSection
                comments={context.comments}
              />
            </>
          )}
        </ContentPanelBody>
      )}
    </ContentPanel>
  );
}
