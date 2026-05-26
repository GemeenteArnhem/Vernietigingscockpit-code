import { useState } from "react";

export type TaskStatus =
  | "ACTIEF"
  | "GEPLAND"
  | "IDLE"
  | "VERTRAAGD";

type Props = {
  total: number;
  actief: number;
  vertraagd: number;
  inactief: number;

  onSearch?: (value: string) => void;
  onStatusChange?: (statuses: TaskStatus[]) => void;
};

const statuses: TaskStatus[] = [
  "ACTIEF",
  "GEPLAND",
  "IDLE",
  "VERTRAAGD",
];

const labels: Record<TaskStatus, string> = {
  ACTIEF: "Actief",
  GEPLAND: "Gepland",
  IDLE: "Idle",
  VERTRAAGD: "Vertraagd",
};

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-4 h-4"
    fill="none"
  >
    <circle
      cx="11"
      cy="11"
      r="7"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M20 20L17 17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const ChartIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5"
    fill="none"
  >
    <path
      d="M5 18V12"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M10 18V8"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M15 18V5"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="M20 18V10"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

export default function TaskDefinitionFilters({
  total,
  actief,
  vertraagd,
  inactief,
  onSearch,
  onStatusChange,
}: Props) {
  const [selected, setSelected] = useState<TaskStatus[]>(
    statuses
  );

  const toggleStatus = (status: TaskStatus) => {
    let next: TaskStatus[];

    if (selected.includes(status)) {
      next = selected.filter(
        (s) => s !== status
      );
    } else {
      next = [...selected, status];
    }

    setSelected(next);

    onStatusChange?.(next);
  };

  return (
    <div className="border-b border-gray-200 bg-white">

      <div className="flex items-stretch">

        {/* links */}
        <div className="flex-1 px-5 py-4 flex items-center gap-3">

          {/* search */}
          <div className="relative w-[280px]">

            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>

            <input
              placeholder="Zoek taakdefinitie..."
              onChange={(e) =>
                onSearch?.(
                  e.target.value
                )
              }
              className="
                w-full
                border
                border-gray-200
                rounded-lg
                h-11
                pl-10
                pr-4
                text-sm
                focus:outline-none
                focus:ring-2
                focus:ring-blue-500
              "
            />
          </div>

          {/* status filters */}
          <div className="flex gap-2">

            {statuses.map((status) => {
              const active =
                selected.includes(status);

              return (
                <button
                  key={status}
                  onClick={() =>
                    toggleStatus(status)
                  }
                  className={`
                    h-11
                    px-4
                    rounded-lg
                    border
                    text-sm
                    font-medium
                    transition-all
                    ${
                      active
                        ? `
                        border-blue-500
                        bg-blue-50
                        text-blue-600
                      `
                        : `
                        border-gray-200
                        text-gray-600
                        hover:bg-gray-50
                      `
                    }
                  `}
                >
                  {labels[status]}
                </button>
              );
            })}
          </div>

        </div>

        {/* stats rechts */}
        <div className="w-[320px] border-l border-gray-200 px-5 flex items-center gap-4">

          <div className="text-gray-500">
            <ChartIcon />
          </div>

          <div className="flex flex-col">

            <span className="font-medium text-sm">
              {total} taken totaal
            </span>

            <div className="text-sm mt-1 flex gap-2">

              <span className="text-green-600">
                {actief} actief
              </span>

              <span className="text-red-600">
                • {vertraagd} vertraagd
              </span>

              <span className="text-gray-500">
                • {inactief} inactief
              </span>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}