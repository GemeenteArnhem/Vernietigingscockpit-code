import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type TaskStatus =
  | "actie-vereist"
  | "lopend"
  | "gepland"
  | "voltooid";

export type TaskFilter =
  | "alle"
  | "actie-vereist"
  | "lopend"
  | "gepland";

export type TaskSidebarItem = {
  id: string;
  naam: string;
  frequentie: string;
  status: TaskStatus;
  subtitle: string;
};

type Props = {
  tasks: TaskSidebarItem[];

  selectedTaskId?: string;

  onSelectTask?: (
    taskId: string
  ) => void;

  search: string;

  onSearchChange: (
    value: string
  ) => void;

  activeFilter: TaskFilter;

  onFilterChange: (
    filter: TaskFilter
  ) => void;
};

const filters = [
  {
    label: "Alle",
    value: "alle",
  },
  {
    label:
      "Actie vereist",
    value:
      "actie-vereist",
  },
  {
    label: "Lopend",
    value: "lopend",
  },
  {
    label: "Gepland",
    value: "gepland",
  },
];

const statusColors = {
  "actie-vereist":
    "text-red-500",

  lopend:
    "text-blue-600",

  gepland:
    "text-amber-600",

  voltooid:
    "text-gray-400",
};

const statusDots = {
  "actie-vereist":
    "bg-red-500",

  lopend:
    "bg-blue-500",

  gepland:
    "bg-amber-500",

  voltooid:
    "bg-gray-300",
};

export default function TaskSidebar({
  tasks,
  selectedTaskId,
  onSelectTask,
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: Props) {
  const navigate =
    useNavigate();

  const filteredTasks =
    tasks.filter((task) => {
      const matchesFilter =
        activeFilter ===
          "alle" ||
        task.status ===
          activeFilter;

      const matchesSearch =
        task.naam
          .toLowerCase()
          .includes(
            search.toLowerCase()
          );

      return (
        matchesFilter &&
        matchesSearch
      );
    });

  return (
    <aside
      className="
        w-[370px]
        bg-white
        border-r
        border-gray-200
        flex
        flex-col
        overflow-hidden
      "
    >
      {/* HEADER */}
      <div
        className="
          px-3
          pt-4
          pb-3
          border-b
          border-gray-100
        "
      >
        <h2
          className="
            text-2xl
            font-semibold
            text-gray-900
            leading-none
          "
        >
          Taken
        </h2>

        {/* SEARCH */}
        <div className="relative mt-4">
          <Search
            size={15}
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-gray-400
            "
          />

          <input
            value={search}
            onChange={(e) =>
              onSearchChange(
                e.target.value
              )
            }
            placeholder="Zoek taak ..."
            className="
              w-full
              h-10
              rounded-lg
              border
              border-gray-300
              pl-9
              pr-3
              text-sm
              outline-none
              focus:border-blue-500
            "
          />
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-2 mt-3">
          {filters.map(
            (filter) => (
              <button
                key={
                  filter.value
                }
                onClick={() =>
                  onFilterChange(
                    filter.value as TaskFilter
                  )
                }
                className={`
                  px-3
                  h-8
                  rounded-md
                  border
                  text-[14px]
                  transition-colors

                  ${
                    activeFilter ===
                    filter.value
                      ? `
                        bg-blue-600
                        text-white
                        border-blue-600
                      `
                      : `
                        bg-white
                        border-gray-300
                        text-gray-700
                        hover:bg-gray-50
                      `
                  }
                `}
              >
                {filter.label}
              </button>
            )
          )}
        </div>
      </div>

      {/* TASK LIST */}
      <div className="flex-1 overflow-y-auto">
        {filteredTasks.map(
          (task) => {
            const selected =
              selectedTaskId ===
              task.id;

            return (
              <button
                key={task.id}
                onClick={() => {
                  onSelectTask?.(
                    task.id
                  );

                  navigate(
                    `/taak/${task.id}`
                  );
                }}
                className={`
                  relative
                  w-full
                  text-left
                  px-4
                  py-3
                  border-b
                  border-gray-100
                  transition-colors

                  ${
                    selected
                      ? `
                        bg-slate-50
                      `
                      : `
                        hover:bg-gray-50
                      `
                  }
                `}
              >
                {/* selected indicator */}
                {selected && (
                  <div
                    className="
                      absolute
                      left-0
                      top-0
                      bottom-0
                      w-[2px]
                      bg-blue-600
                    "
                  />
                )}

                <div className="flex gap-2.5">

                  {/* DOT */}
                  <div
                    className={`
                      mt-[7px]
                      h-2
                      w-2
                      rounded-full
                      shrink-0
                      ${
                        statusDots[
                          task.status
                        ]
                      }
                    `}
                  />

                  {/* CONTENT */}
                  <div className="min-w-0">

                    {/* title */}
                    <div
                      className="
                        text-[15px]
                        font-medium
                        text-gray-900
                        leading-[20px]
                      "
                    >
                      {task.naam}
                    </div>

                    {/* frequency */}
                    <div
                      className="
                        text-[13px]
                        text-gray-400
                        leading-[18px]
                      "
                    >
                      {
                        task.frequentie
                      }
                    </div>

                    {/* status */}
                    <div
                      className={`
                        text-[12px]
                        leading-[18px]
                        mt-[2px]

                        ${
                          statusColors[
                            task.status
                          ]
                        }
                      `}
                    >
                      {
                        task.subtitle
                      }
                    </div>
                  </div>

                </div>
              </button>
            );
          }
        )}
      </div>
    </aside>
  );
}
