import {
  Building2,
  CalendarDays,
  FileText,
  FolderArchive,
  MessageSquareMore,
  MoreHorizontal,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
} from "../../../../components/ContentPanel";
import RecordCommentsSection from "../../components/RecordCommentsSection";
import RecordDetailsSection from "../../components/RecordDetailsSection";
import TaskExecutionHeader from "../../components/TaskExecutionHeader";
import type { VernietigingsObject } from "../../../../shared/types/destruction";
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
  title: string;
  queueStatus: ReviewQueueStatus;
  selectieregel: string;
  bewaartermijn: string;
  vernietigingsdatum: string;
  hasComments: boolean;
};

type Props = {
  record?: VernietigingsObject;
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
  onPrevious?: () => void;
  onNext?: () => void;
};

const CHUNK_SIZE = 25;

function getQueueIcon(queueStatus: ReviewQueueStatus) {
  if (queueStatus === "afgerond") {
    return {
      icon: <ShieldCheck size={15} className="text-emerald-600" />,
      className: "border-emerald-200 bg-emerald-50",
    };
  }

  if (queueStatus === "conflict") {
    return {
      icon: <ShieldAlert size={15} className="text-rose-600" />,
      className: "border-rose-200 bg-rose-50",
    };
  }

  return {
    icon: <FileText size={15} className="text-slate-400" />,
    className: "border-slate-200 bg-slate-50",
  };
}

function ReviewChunkedTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  activeRecordId,
  onActiveRecordChange,
}: {
  rows: ReviewRecordTableRow[];
  selectedIds: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  activeRecordId?: string | null;
  onActiveRecordChange?: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      [row.title, row.selectieregel, row.vernietigingsdatum]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, search]);

  const visibleRows = filteredRows.slice(0, visibleCount);
  const hasMore = visibleCount < filteredRows.length;
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));

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

  const handleScroll = () => {
    const element = scrollRef.current;

    if (!element || !hasMore) {
      return;
    }

    const threshold = 96;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (remaining < threshold) {
      setVisibleCount((current) => Math.min(current + CHUNK_SIZE, filteredRows.length));
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(CHUNK_SIZE);
                }}
                placeholder="Zoek op titel, selectieregel of vernietigingsdatum..."
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
              />
            </label>

            <button
              type="button"
              onClick={toggleVisibleRows}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {allVisibleSelected
                ? `Deselecteer ${visibleRows.length.toLocaleString("nl-NL")} in deze groep`
                : `Selecteer alle ${visibleRows.length.toLocaleString("nl-NL")} in deze groep`}
            </button>
          </div>

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

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto"
      >
        <table className="w-full min-w-[860px] table-fixed text-sm">
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
              <th className="sticky top-0 z-10 w-[34%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Titel
              </th>
              <th className="sticky top-0 z-10 w-[11%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Status
              </th>
              <th className="sticky top-0 z-10 w-[16%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Selectieregel
              </th>
              <th className="sticky top-0 z-10 w-[14%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Bewaartermijn
              </th>
              <th className="sticky top-0 z-10 w-[16%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Vernietigingsdatum
              </th>
              <th className="sticky top-0 z-10 w-[9%] bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Opmerking
              </th>
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
                      aria-label={`Selecteer ${row.title}`}
                    />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onActiveRecordChange?.(row.id);
                      }}
                      className="truncate text-left font-medium text-slate-900 hover:text-blue-700"
                      title={row.title}
                    >
                      {row.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${queueIcon.className}`}>
                      {queueIcon.icon}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-slate-700">{row.selectieregel}</td>
                  <td className="px-4 py-3 align-middle text-slate-700">{row.bewaartermijn}</td>
                  <td className="px-4 py-3 align-middle text-slate-700">{row.vernietigingsdatum}</td>
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                        row.hasComments
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-slate-200 bg-slate-50 text-slate-300"
                      }`}
                      title={row.hasComments ? "Heeft opmerkingen" : "Geen opmerkingen"}
                    >
                      <MessageSquareMore size={15} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
        <div>
          {visibleRows.length.toLocaleString("nl-NL")} van {filteredRows.length.toLocaleString("nl-NL")} records geladen
        </div>
        <div className="text-right">
          {hasMore ? "Scroll om meer records te laden" : "Alle records in deze groep zijn geladen"}
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
