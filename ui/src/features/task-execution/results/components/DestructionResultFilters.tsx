import { useEffect, useRef, useState } from "react";

import type { DestructionResultColumnKey, DestructionResultStatus } from "../../../../shared/types/destructionResult";
import {
  DESTRUCTION_RESULT_COLUMN_GROUPS,
  DESTRUCTION_RESULT_COLUMN_LABELS,
} from "../../../../shared/types/destructionResult";

type Props = {
  visibleColumns: Record<DestructionResultColumnKey, boolean>;
  onToggleColumn: (key: DestructionResultColumnKey) => void;
  statusFilter: DestructionResultStatus | null;
  onStatusFilter: (value: DestructionResultStatus | null) => void;
  searchQuery: string;
  onSearchQuery: (value: string) => void;
};

const STATUS_OPTIONS: {
  value: DestructionResultStatus | null;
  label: string;
}[] = [
  { value: null, label: "Alle resultaten" },
  { value: "SUCCES", label: "Succes" },
  { value: "FOUT", label: "Fouten" },
  { value: "NIET_GEVONDEN", label: "Niet gevonden" },
  { value: "OVERIG", label: "Overige" },
];

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path d="M4 5H20L14 12V19L10 21V12L4 5Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const ColumnsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

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

export default function DestructionResultFilters({
  visibleColumns,
  onToggleColumn,
  statusFilter,
  onStatusFilter,
  searchQuery,
  onSearchQuery,
}: Props) {
  const status = useDropdown();
  const columns = useDropdown();

  const activeStatusLabel =
    STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ??
    "Resultaat filter";

  return (
    <div className="rounded-t-2xl border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[420px]">
            <input
              type="text"
              placeholder="Zoek op titel, stekker of bron-ID..."
              value={searchQuery}
              onChange={(event) => onSearchQuery(event.target.value)}
              className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>
          </div>

          <div className="relative" ref={status.ref}>
            <button
              type="button"
              onClick={() => status.setOpen((current) => !current)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                status.open || statusFilter !== null
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-200 text-blue-600"
              }`}
            >
              <FilterIcon />
              {activeStatusLabel}
            </button>

            {status.open && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[190px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => {
                      onStatusFilter(option.value);
                      status.setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      statusFilter === option.value
                        ? "font-medium text-blue-600"
                        : "text-gray-700"
                    }`}
                  >
                    {option.label}
                    {statusFilter === option.value && (
                      <span className="text-xs text-blue-600">OK</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative self-start lg:self-auto" ref={columns.ref}>
          <button
            type="button"
            onClick={() => columns.setOpen((current) => !current)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
              columns.open
                ? "border-blue-500 bg-blue-50 text-blue-600"
                : "border-gray-200 text-blue-600"
            }`}
          >
            <ColumnsIcon />
            Kolommen
          </button>

          {columns.open && (
            <div className="absolute right-0 top-full z-20 mt-1 max-h-80 min-w-[220px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
              {DESTRUCTION_RESULT_COLUMN_GROUPS.map((group) => (
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
                        onChange={() => onToggleColumn(key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {DESTRUCTION_RESULT_COLUMN_LABELS[key]}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
