import { useMemo, useState } from "react";

import StatusBadge from "../../../../components/StatusBadge";
import type {
  DestructionResultColumnKey,
  DestructionResultRow,
  DestructionResultStatus,
} from "../../../../shared/types/destructionResult";

type SortKey = "naam" | "stekker" | "resultaat";
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
  const [sortKey, setSortKey] = useState<SortKey>("naam");
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
      if (statusFilter && row.resultaat !== statusFilter) {
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
              onClick={() => toggleSort("naam")}
              className="w-[28%] cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
            >
              Titel
              <SortIcon active={sortKey === "naam"} dir={sortDir} />
            </th>
            <th
              onClick={() => toggleSort("stekker")}
              className="w-[18%] cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
            >
              Stekker
              <SortIcon active={sortKey === "stekker"} dir={sortDir} />
            </th>
            <th
              onClick={() => toggleSort("resultaat")}
              className="w-[18%] cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 hover:text-gray-900"
            >
              Vernietigingstatus
              <SortIcon
                active={sortKey === "resultaat"}
                dir={sortDir}
              />
            </th>

            {col("omvang") && (
              <th className="w-[8%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Omvang
              </th>
            )}
            {col("termijnEinddatum") && (
              <th className="w-[12%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Vernietigingsdatum
              </th>
            )}
            {col("identificatie") && (
              <th className="w-[14%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Bron-ID
              </th>
            )}
            {col("classificatie") && (
              <th className="w-[8%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Code
              </th>
            )}
            {col("informatiecategorie") && (
              <th className="w-[16%] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Grondslag
              </th>
            )}
            {col("stekker") && (
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
                {row.naam}
              </td>
              <td className="px-4 py-3">{row.stekker}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.resultaat} />
              </td>

              {col("omvang") && (
                <td className="px-4 py-3 text-gray-500">{row.omvang ?? "-"}</td>
              )}
              {col("termijnEinddatum") && (
                <td className="px-4 py-3 text-gray-500">
                  {row.termijnEinddatum ?? "-"}
                </td>
              )}
              {col("identificatie") && (
                <td className="truncate px-4 py-3 text-gray-500" title={row.identificatie}>
                  {row.identificatie ?? "-"}
                </td>
              )}
              {col("classificatie") && (
                <td className="px-4 py-3 text-gray-500">{row.classificatie ?? "-"}</td>
              )}
              {col("informatiecategorie") && (
                <td className="truncate px-4 py-3 text-gray-500" title={row.informatiecategorie}>
                  {row.informatiecategorie ?? "-"}
                </td>
              )}
              {col("stekker") && (
                <td className="px-4 py-3 text-gray-500">
                  {row.stekker ?? "-"}
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
