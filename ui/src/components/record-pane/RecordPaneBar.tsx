import {
  ChevronRight,
  Circle,
} from "lucide-react";

import StatusBadge from "../StatusBadge";

export type RecordPaneBarTone =
  | "danger"
  | "info"
  | "warning"
  | "success"
  | "neutral";

export type RecordPaneBarTab = {
  key: string;
  label: string;
  count?: number;
};

export type RecordPaneBarFilter = {
  key: string;
  label: string;
};

export type RecordPaneBarItem = {
  id: string;
  title: string;
  stepLabel: string;
  stepTone?: RecordPaneBarTone;
  status: string;
  quantityLabel?: string;
  quantityValue?: string;
  progress?: number;
  progressTone?: RecordPaneBarTone;
};

type Props = {
  title: string;
  searchValue?: string;
  onSearchChange?: (
    value: string
  ) => void;
  searchPlaceholder?: string;
  tabs: RecordPaneBarTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  filters: RecordPaneBarFilter[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
  items: RecordPaneBarItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
  widthClassName?: string;
  density?: "default" | "compact";
  showItemMeta?: boolean;
};

const toneStyles: Record<
  RecordPaneBarTone,
  {
    dot: string;
    progress: string;
  }
> = {
  danger: {
    dot: "text-red-500",
    progress: "bg-red-400",
  },
  info: {
    dot: "text-blue-500",
    progress: "bg-blue-500",
  },
  warning: {
    dot: "text-amber-500",
    progress: "bg-amber-400",
  },
  success: {
    dot: "text-green-500",
    progress: "bg-green-500",
  },
  neutral: {
    dot: "text-slate-400",
    progress: "bg-slate-300",
  },
};

export default function RecordPaneBar({
  title,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Zoek taak...",
  tabs,
  activeTab,
  onTabChange,
  filters,
  activeFilter,
  onFilterChange,
  items,
  selectedId,
  onSelect,
  emptyMessage = "Geen records gevonden binnen deze selectie.",
  widthClassName = "w-[380px]",
  density = "default",
  showItemMeta = true,
}: Props) {
  const isCompact = density === "compact";

  return (
    <aside className={`${widthClassName} border-r border-slate-200 bg-slate-50/60 p-4`}>
      <div className="flex h-full flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 px-4 pb-4 pt-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
          </div>

          {onSearchChange && (
            <div className="mt-4">
              <input
                value={searchValue}
                onChange={(event) =>
                  onSearchChange(
                    event.target.value
                  )
                }
                placeholder={
                  searchPlaceholder
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>
          )}

          {tabs.length > 1 && (
            <div className="mt-4 flex gap-1.5">
              {tabs.map((tab) => {
                const active =
                  activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    onClick={() =>
                      onTabChange(tab.key)
                    }
                    className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "rounded-lg border-blue-200 bg-blue-50 text-blue-700"
                        : "rounded-lg border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{tab.label}</span>

                    {typeof tab.count ===
                      "number" && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                          active
                            ? "bg-white text-blue-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {filters.map((filter) => {
              const active =
                activeFilter ===
                filter.key;

              return (
                <button
                  key={filter.key}
                  onClick={() =>
                    onFilterChange(
                      filter.key
                    )
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <div className={isCompact ? "space-y-1.5" : "space-y-2"}>
              {items.map((item) => {
                const selected =
                  selectedId === item.id;

                const stepTone =
                  toneStyles[
                    item.stepTone ??
                      "neutral"
                  ];

                const progressTone =
                  toneStyles[
                    item.progressTone ??
                      item.stepTone ??
                      "neutral"
                  ];

                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      onSelect(item.id)
                    }
                    className={`w-full border text-left transition-all ${
                      selected
                        ? "rounded-lg border-blue-200 bg-blue-50/60 shadow-sm shadow-blue-100/60"
                        : "rounded-lg border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                    } ${isCompact ? "px-3 py-2.5" : "px-4 py-3"}`}
                  >
                    <div className={`flex items-start justify-between gap-3 ${isCompact ? "mb-2" : ""}`}>
                      <div className="min-w-0">
                        <div
                          className={`font-semibold leading-5 text-slate-900 ${
                            isCompact ? "text-[13px]" : "text-sm"
                          }`}
                        >
                          {item.title}
                        </div>
                      </div>

                      <ChevronRight
                        size={17}
                        className={`shrink-0 ${
                          selected
                            ? "text-blue-600"
                            : "text-slate-300"
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`inline-flex items-center gap-1.5 text-slate-600 ${
                          isCompact
                            ? "rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium"
                            : "rounded-full px-2.5 py-1 text-xs font-medium"
                        }`}
                      >
                        <Circle
                          size={7}
                          fill="currentColor"
                          className={
                            stepTone.dot
                          }
                        />
                        <span>
                          {item.stepLabel}
                        </span>
                      </div>

                      <StatusBadge
                        status={item.status}
                      />
                    </div>

                    {(showItemMeta || isCompact) &&
                      (item.quantityValue ||
                        typeof item.progress ===
                          "number") && (
                      <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                        {item.quantityValue ? (
                          <div className={`${isCompact ? "text-sm" : "text-xs"} text-slate-500`}>
                            <span className={`text-slate-700 ${isCompact ? "font-medium" : "font-medium"}`}>
                              {item.quantityLabel ??
                                "Omvang"}
                              :
                            </span>{" "}
                            {
                              item.quantityValue
                            }
                          </div>
                        ) : (
                          <div />
                        )}

                        {typeof item.progress ===
                          "number" && (
                          <div className="flex min-w-[96px] items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${progressTone.progress}`}
                                style={{
                                  width: `${Math.max(
                                    Math.min(
                                      item.progress,
                                      100
                                    ),
                                    0
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-slate-500">
                              {item.progress}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
