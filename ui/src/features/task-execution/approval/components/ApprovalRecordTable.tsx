import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { VernietigingsObject } from "../../../../shared/types/destruction";

type ApprovalColumnKey =
  | "omvang"
  | "bewaartermijn"
  | "vernietigingsdatum"
  | "reden"
  | "toelichting"
  | "accorderingsToelichting"
  | "bron_id"
  | "code"
  | "periode"
  | "selectielijst"
  | "grondslag"
  | "bron_systeem";

type Props = {
  rows: VernietigingsObject[];
  approvalCommentLabel?: string;
  approvalCommentValue?: (row: VernietigingsObject) => string;
  onApprovalCommentChange?: (rowId: string, value: string) => void;
};

type ColumnDefinition = {
  key: string;
  label: string;
  widthClassName: string;
  render: (row: VernietigingsObject) => ReactNode;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const COLUMN_LABELS: Record<ApprovalColumnKey, string> = {
  omvang: "Omvang",
  bewaartermijn: "Bewaartermijn",
  vernietigingsdatum: "Vernietigingsdatum",
  reden: "Reden",
  toelichting: "Toelichting",
  accorderingsToelichting: "Toelichting accordering",
  bron_id: "Bron-ID",
  code: "Code",
  periode: "Periode",
  selectielijst: "Selectielijst",
  grondslag: "Grondslag",
  bron_systeem: "Bronsysteem",
};

const COLUMN_GROUPS: Array<{
  label: string;
  keys: ApprovalColumnKey[];
}> = [
  {
    label: "Primaire kolommen",
    keys: [
      "omvang",
      "bewaartermijn",
      "vernietigingsdatum",
      "reden",
      "toelichting",
      "accorderingsToelichting",
    ],
  },
  {
    label: "Metadata",
    keys: ["bron_id", "code", "periode", "selectielijst", "grondslag", "bron_systeem"],
  },
];

const DEFAULT_COLUMNS: Record<ApprovalColumnKey, boolean> = {
  omvang: true,
  bewaartermijn: true,
  vernietigingsdatum: true,
  reden: false,
  toelichting: false,
  accorderingsToelichting: true,
  bron_id: false,
  code: false,
  periode: false,
  selectielijst: false,
  grondslag: false,
  bron_systeem: false,
};

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

function formatCellValue(value?: string) {
  return value || "—";
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const normalizedStart = Math.max(1, end - 4);

  return Array.from(
    { length: end - normalizedStart + 1 },
    (_, index) => normalizedStart + index
  );
}

export default function ApprovalRecordTable({
  rows,
  approvalCommentLabel = "Toelichting accordering",
  approvalCommentValue,
  onApprovalCommentChange,
}: Props) {
  const columns = useDropdown();
  const [visibleColumns, setVisibleColumns] =
    useState<Record<ApprovalColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(
    () => rows.filter((row) => !row.uitgesloten),
    [rows]
  );

  const showApprovalCommentColumn =
    visibleColumns.accorderingsToelichting &&
    typeof approvalCommentValue === "function" &&
    typeof onApprovalCommentChange === "function";

  const columnDefinitions = useMemo<ColumnDefinition[]>(() => {
    const definitions: ColumnDefinition[] = [
      {
        key: "titel",
        label: "Titel",
        widthClassName: "w-[28%] min-w-[320px]",
        render: (row) => (
          <span className="block truncate font-medium text-gray-900" title={row.titel}>
            {row.titel}
          </span>
        ),
      },
    ];

    if (visibleColumns.omvang) {
      definitions.push({
        key: "omvang",
        label: "Omvang",
        widthClassName: "w-[8%] min-w-[110px]",
        render: (row) => row.omvang,
      });
    }

    if (visibleColumns.bewaartermijn) {
      definitions.push({
        key: "bewaartermijn",
        label: "Bewaartermijn",
        widthClassName: "w-[10%] min-w-[140px]",
        render: (row) => `${row.bewaartermijn} jaar`,
      });
    }

    if (visibleColumns.vernietigingsdatum) {
      definitions.push({
        key: "vernietigingsdatum",
        label: "Vernietigingsdatum",
        widthClassName: "w-[12%] min-w-[150px]",
        render: (row) => row.vernietigingsdatum,
      });
    }

    if (visibleColumns.reden) {
      definitions.push({
        key: "reden",
        label: "Reden",
        widthClassName: "w-[14%] min-w-[180px]",
        render: (row) => formatCellValue(row.reden),
      });
    }

    if (visibleColumns.toelichting) {
      definitions.push({
        key: "toelichting",
        label: "Toelichting",
        widthClassName: "w-[18%] min-w-[220px]",
        render: (row) => formatCellValue(row.toelichting),
      });
    }

    if (showApprovalCommentColumn) {
      definitions.push({
        key: "accorderingsToelichting",
        label: approvalCommentLabel,
        widthClassName: "w-[22%] min-w-[280px]",
        render: (row) => (
          <input
            type="text"
            value={approvalCommentValue(row)}
            onChange={(event) => onApprovalCommentChange(row.id, event.target.value)}
            placeholder="Toelichting..."
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        ),
      });
    }

    if (visibleColumns.bron_id) {
      definitions.push({
        key: "bron_id",
        label: "Bron-ID",
        widthClassName: "w-[12%] min-w-[170px]",
        render: (row) => formatCellValue(row.bron_id),
      });
    }

    if (visibleColumns.code) {
      definitions.push({
        key: "code",
        label: "Code",
        widthClassName: "w-[8%] min-w-[110px]",
        render: (row) => formatCellValue(row.code),
      });
    }

    if (visibleColumns.periode) {
      definitions.push({
        key: "periode",
        label: "Periode",
        widthClassName: "w-[16%] min-w-[170px]",
        render: (row) =>
          row.startdatum && row.einddatum
            ? `${row.startdatum} - ${row.einddatum}`
            : "—",
      });
    }

    if (visibleColumns.selectielijst) {
      definitions.push({
        key: "selectielijst",
        label: "Selectielijst",
        widthClassName: "w-[10%] min-w-[150px]",
        render: (row) => formatCellValue(row.selectielijst),
      });
    }

    if (visibleColumns.grondslag) {
      definitions.push({
        key: "grondslag",
        label: "Grondslag",
        widthClassName: "w-[14%] min-w-[180px]",
        render: (row) => formatCellValue(row.grondslag),
      });
    }

    if (visibleColumns.bron_systeem) {
      definitions.push({
        key: "bron_systeem",
        label: "Bronsysteem",
        widthClassName: "w-[10%] min-w-[150px]",
        render: (row) => formatCellValue(row.bron_systeem),
      });
    }

    return definitions;
  }, [
    approvalCommentLabel,
    approvalCommentValue,
    onApprovalCommentChange,
    showApprovalCommentColumn,
    visibleColumns,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const currentRows = filteredRows.slice(startIndex, endIndex);
  const pageNumbers = getVisiblePageNumbers(safeCurrentPage, totalPages);

  const toggleColumn = (key: ApprovalColumnKey) => {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Vast te stellen records
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Dit zijn alleen de records die daadwerkelijk voor vernietiging worden vastgesteld.
          </p>
        </div>

        <div className="relative" ref={columns.ref}>
          <button
            type="button"
            onClick={() => columns.setOpen((current) => !current)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
              columns.open
                ? "border-blue-500 bg-blue-50 text-blue-600"
                : "border-gray-200 text-blue-600"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M4 6H20M4 12H20M4 18H20"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Kolommen
          </button>

          {columns.open && (
            <div className="absolute right-0 top-full z-20 mt-1 max-h-80 min-w-[220px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
              {COLUMN_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {group.label}
                  </p>

                  {group.keys.map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[key]}
                        onChange={() => toggleColumn(key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {COLUMN_LABELS[key]}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-max table-fixed text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {columnDefinitions.map((column) => (
                <th
                  key={column.key}
                  className={`${column.widthClassName} px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {currentRows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-gray-200 transition-colors hover:bg-gray-50"
              >
                {columnDefinitions.map((column) => (
                  <td
                    key={`${row.id}-${column.key}`}
                    className={`${column.widthClassName} px-4 py-3 align-middle text-gray-700`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-500">
          {`${(startIndex + 1).toLocaleString("nl-NL")}–${endIndex.toLocaleString("nl-NL")} van ${filteredRows.length.toLocaleString("nl-NL")} records`}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Regels per pagina
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage === 1}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Vorige
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`min-w-9 rounded-md px-3 py-1.5 text-sm transition ${
                    pageNumber === safeCurrentPage
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage === totalPages}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
