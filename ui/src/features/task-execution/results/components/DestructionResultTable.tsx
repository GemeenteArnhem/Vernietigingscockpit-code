import { useMemo, useState } from "react";

import StatusBadge from "../../../../components/StatusBadge";
import type {
  DestructionResultColumnKey,
  DestructionResultRow,
  DestructionResultStatus,
} from "../../../../shared/types/destructionResult";

type SortKey = "titel" | "stekker" | "vernietigingsstatus";
type SortDir = "asc" | "desc" | null;

type Props = {
  rows: DestructionResultRow[];
  visibleColumns: Record<DestructionResultColumnKey, boolean>;
  statusFilter: DestructionResultStatus | null;
  searchQuery: string;
};

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>;
  if (dir === "asc") return <span className="ml-1">↑</span>;
  if (dir === "desc") return <span className="ml-1">↓</span>;
  return <span className="ml-1 text-gray-300">↕</span>;
}

export default function DestructionResultTable({
  rows,
  visibleColumns,
  statusFilter,
  searchQuery,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("titel");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const col = (key: DestructionResultColumnKey) => visibleColumns[key];

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

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (statusFilter && row.vernietigingsstatus !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return Object.values(row).some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );
    });

    if (!sortDir) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const valA = String(a[sortKey] ?? "");
      const valB = String(b[sortKey] ?? "");
      return sortDir === "asc"
        ? valA.localeCompare(valB, "nl")
        : valB.localeCompare(valA, "nl");
    });
  }, [rows, searchQuery, sortDir, sortKey, statusFilter]);

  return (
    <div className="max-h-[calc(100vh-340px)] overflow-auto">
      <table className="w-full table-fixed text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-left">
          <tr>
            <th
              onClick={() => toggleSort("titel")}
              className="w-[28%] cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
            >
              Titel
              <SortIcon active={sortKey === "titel"} dir={sortDir} />
            </th>
            <th
              onClick={() => toggleSort("stekker")}
              className="w-[18%] cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
            >
              Stekker
              <SortIcon active={sortKey === "stekker"} dir={sortDir} />
            </th>
            <th
              onClick={() => toggleSort("vernietigingsstatus")}
              className="w-[18%] cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
            >
              Vernietigingstatus
              <SortIcon
                active={sortKey === "vernietigingsstatus"}
                dir={sortDir}
              />
            </th>

            {col("omvang") && (
              <th className="w-[8%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Omvang
              </th>
            )}
            {col("vernietigingsdatum") && (
              <th className="w-[12%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Vernietigingsdatum
              </th>
            )}
            {col("bron_id") && (
              <th className="w-[14%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Bron-ID
              </th>
            )}
            {col("code") && (
              <th className="w-[8%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Code
              </th>
            )}
            {col("grondslag") && (
              <th className="w-[16%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Grondslag
              </th>
            )}
            {col("bron_systeem") && (
              <th className="w-[12%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Bronsysteem
              </th>
            )}
            {col("melding") && (
              <th className="w-[22%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Melding
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.id} className="border-t border-gray-200 text-gray-700 transition-colors hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {row.titel}
              </td>
              <td className="px-4 py-3">{row.stekker}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.vernietigingsstatus} />
              </td>

              {col("omvang") && (
                <td className="px-4 py-3 text-gray-500">{row.omvang ?? "-"}</td>
              )}
              {col("vernietigingsdatum") && (
                <td className="px-4 py-3 text-gray-500">
                  {row.vernietigingsdatum ?? "-"}
                </td>
              )}
              {col("bron_id") && (
                <td className="truncate px-4 py-3 text-gray-500" title={row.bron_id}>
                  {row.bron_id ?? "-"}
                </td>
              )}
              {col("code") && (
                <td className="px-4 py-3 text-gray-500">{row.code ?? "-"}</td>
              )}
              {col("grondslag") && (
                <td className="truncate px-4 py-3 text-gray-500" title={row.grondslag}>
                  {row.grondslag ?? "-"}
                </td>
              )}
              {col("bron_systeem") && (
                <td className="px-4 py-3 text-gray-500">
                  {row.bron_systeem ?? "-"}
                </td>
              )}
              {col("melding") && (
                <td className="px-4 py-3 text-gray-500">{row.melding ?? "-"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
