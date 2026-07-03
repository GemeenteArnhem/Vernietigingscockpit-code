import { useEffect, useMemo, useState } from "react";

import StatusBadge from "../../../../components/StatusBadge";
import type { VernietigingsObject } from "../../../../shared/types/destruction";
import type { ColumnKey } from "../../../../shared/types/reviewColumns";

type SortKey =
  | "titel"
  | "omvang"
  | "bewaartermijn"
  | "vernietigingsdatum";

type SortDir = "asc" | "desc" | null;

type Props = {
  rows: VernietigingsObject[];
  setRows: (rows: VernietigingsObject[]) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  visibleColumns: Record<ColumnKey, boolean>;
  statusFilter: string | null;
  searchQuery: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function hasError(row: VernietigingsObject) {
  return Boolean(row.beoordeeld && row.uitgesloten && !row.toelichting?.trim());
}

function getStatus(row: VernietigingsObject) {
  return hasError(row) ? "FOUT" : "SUCCES";
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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ReviewMark({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      title={checked ? "Beoordeeld" : "Nog niet beoordeeld"}
      aria-label={checked ? "Beoordeeld" : "Nog niet beoordeeld"}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
        checked
          ? "border-green-300 bg-green-50 text-green-700"
          : "border-gray-300 bg-white text-gray-300 hover:border-blue-300 hover:text-blue-600"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path
          d="M5 13L10 18L19 7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
}

export default function ReviewResultTable({
  rows,
  setRows,
  selected,
  setSelected,
  visibleColumns,
  statusFilter,
  searchQuery,
}: Props) {
  const col = (key: ColumnKey) => visibleColumns[key];
  const [sortKey, setSortKey] = useState<SortKey>("vernietigingsdatum");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleSelect = (id: string) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id]
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }

    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }

    if (sortDir === "desc") {
      setSortDir(null);
      return;
    }

    setSortDir("asc");
  };

  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (statusFilter && getStatus(row) !== statusFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      return Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(q)
      );
    });

    if (!sortDir) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];

      if (valueA < valueB) {
        return sortDir === "asc" ? -1 : 1;
      }

      if (valueA > valueB) {
        return sortDir === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [rows, searchQuery, statusFilter, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredAndSortedRows.length);
  const currentRows = filteredAndSortedRows.slice(startIndex, endIndex);
  const pageNumbers = getVisiblePageNumbers(safeCurrentPage, totalPages);

  const sortIcon = (active: boolean, dir: SortDir) => {
    if (!active) return <span className="ml-1 text-gray-300">↕</span>;
    if (dir === "asc") return <span className="ml-1">↑</span>;
    if (dir === "desc") return <span className="ml-1">↓</span>;
    return <span className="ml-1 text-gray-300">↕</span>;
  };

  const updateRow = (
    id: string,
    updater: (row: VernietigingsObject) => VernietigingsObject
  ) => {
    setRows(rows.map((row) => (row.id === id ? updater(row) : row)));
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="table-fixed text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="w-10 p-3" />
              <th className="w-10 p-3 text-center" title="Beoordeeld">
                <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4 text-gray-400">
                  <path
                    d="M5 13L10 18L19 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </th>

              <th
                onClick={() => toggleSort("titel")}
                className="w-[260px] cursor-pointer p-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
              >
                Titel
                {sortIcon(sortKey === "titel", sortDir)}
              </th>

              {col("omvang") && (
                <th
                  onClick={() => toggleSort("omvang")}
                  className="w-[100px] cursor-pointer p-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
                >
                  Omvang
                  {sortIcon(sortKey === "omvang", sortDir)}
                </th>
              )}

              {col("bewaartermijn") && (
                <th className="w-[130px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Bewaartermijn
                </th>
              )}

              {col("vernietigingsdatum") && (
                <th
                  onClick={() => toggleSort("vernietigingsdatum")}
                  className="w-[150px] cursor-pointer p-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
                >
                  Vernietigingsdatum
                  {sortIcon(sortKey === "vernietigingsdatum", sortDir)}
                </th>
              )}

              {col("status") && (
                <th className="w-[120px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
              )}

              {col("uitsluiten") && (
                <th className="w-[130px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Uitsluiten
                </th>
              )}

              {col("toelichting") && (
                <th className="w-[260px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Toelichting
                </th>
              )}

              {col("bron_id") && (
                <th className="w-[160px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Bron-ID
                </th>
              )}

              {col("code") && (
                <th className="w-[100px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Code
                </th>
              )}

              {col("periode") && (
                <th className="w-[170px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Periode
                </th>
              )}

              {col("selectielijst") && (
                <th className="w-[140px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Selectielijst
                </th>
              )}

              {col("resultaat") && (
                <th className="w-[140px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Resultaat
                </th>
              )}

              {col("grondslag") && (
                <th className="w-[180px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Grondslag
                </th>
              )}

              {col("bron_systeem") && (
                <th className="w-[150px] p-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Bronsysteem
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {currentRows.map((row) => {
              const error = hasError(row);

              return (
                <tr
                  key={row.id}
                  className={`border-t border-gray-200 transition-colors hover:bg-gray-50 ${
                    error ? "bg-red-50/40" : ""
                  }`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggleSelect(row.id)}
                    />
                  </td>

                  <td className="p-3 text-center">
                    <ReviewMark
                      checked={Boolean(row.beoordeeld)}
                      onChange={() =>
                        updateRow(row.id, (currentRow) => ({
                          ...currentRow,
                          beoordeeld: !currentRow.beoordeeld,
                        }))
                      }
                    />
                  </td>

                  <td className="truncate p-3 font-medium" title={row.titel}>
                    {row.titel}
                  </td>

                  {col("omvang") && <td className="p-3">{row.omvang}</td>}
                  {col("bewaartermijn") && <td className="p-3">{row.bewaartermijn} jaar</td>}
                  {col("vernietigingsdatum") && <td className="p-3">{row.vernietigingsdatum}</td>}

                  {col("status") && (
                    <td className="p-3">
                      <StatusBadge status={getStatus(row)} />
                    </td>
                  )}

                  {col("uitsluiten") && (
                    <td className="p-3">
                      <Toggle
                        checked={row.uitgesloten}
                        onChange={() =>
                          updateRow(row.id, (currentRow) => ({
                            ...currentRow,
                            uitgesloten: !currentRow.uitgesloten,
                          }))
                        }
                      />
                    </td>
                  )}

                  {col("toelichting") && (
                    <td className="p-3">
                      <div className="flex flex-col">
                        <input
                          value={row.toelichting || ""}
                          onChange={(event) =>
                            updateRow(row.id, (currentRow) => ({
                              ...currentRow,
                              toelichting: event.target.value,
                            }))
                          }
                          className={`w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            error ? "border-red-500" : "border-gray-300"
                          }`}
                          placeholder="Toelichting..."
                        />
                        {error && (
                          <span className="mt-1 text-xs text-red-500">
                            Toelichting is verplicht bij uitsluiten
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  {col("bron_id") && (
                    <td className="truncate p-3 text-gray-500" title={row.bron_id}>
                      {formatCellValue(row.bron_id)}
                    </td>
                  )}

                  {col("code") && (
                    <td className="p-3 text-gray-500">{formatCellValue(row.code)}</td>
                  )}

                  {col("periode") && (
                    <td className="p-3 text-gray-500">
                      {row.startdatum && row.einddatum
                        ? `${row.startdatum} - ${row.einddatum}`
                        : "—"}
                    </td>
                  )}

                  {col("selectielijst") && (
                    <td className="p-3 text-gray-500">{formatCellValue(row.selectielijst)}</td>
                  )}

                  {col("resultaat") && (
                    <td className="p-3 text-gray-500">{formatCellValue(row.resultaat)}</td>
                  )}

                  {col("grondslag") && (
                    <td className="truncate p-3 text-gray-500" title={row.grondslag}>
                      {formatCellValue(row.grondslag)}
                    </td>
                  )}

                  {col("bron_systeem") && (
                    <td className="p-3 text-gray-500">{formatCellValue(row.bron_systeem)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-500">
          {`${(startIndex + 1).toLocaleString("nl-NL")}–${endIndex.toLocaleString("nl-NL")} van ${filteredAndSortedRows.length.toLocaleString("nl-NL")} records`}
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
    </div>
  );
}
