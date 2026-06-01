import { useState } from "react";
import {
  ChevronDown,
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

export type RecordPaneBarFilterSection = {
  key: string;
  label: string;
  options: Array<{
    key: string;
    label: string;
    count?: number;
  }>;
  activeKey?: string | null;
  onChange: (key: string) => void;
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
  filterSections?: RecordPaneBarFilterSection[];
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
  filterSections = [],
  items,
  selectedId,
  onSelect,
  emptyMessage = "Geen records gevonden binnen deze selectie.",
  widthClassName = "w-[380px]",
  density = "default",
  showItemMeta = true,
}: Props) {
  const isCompact = density === "compact";
  const [openSecondaryFilterKey, setOpenSecondaryFilterKey] = useState<string | null>(null);
  const compactRowsWithMeta = items.some(
    (item) => (showItemMeta || isCompact) && (item.quantityValue || typeof item.progress === "number")
  );

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

          {filterSections.length > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {filterSections.map((section) => {
                  const activeOption = section.options.find(
                    (option) => option.key === section.activeKey
                  );
                  const isOpen = openSecondaryFilterKey === section.key;

                  return (
                    <button
                      key={section.key}
                      onClick={() =>
                        setOpenSecondaryFilterKey((current) =>
                          current === section.key ? null : section.key
                        )
                      }
                      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        activeOption
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{section.label}:</span>
                      <span>{activeOption?.label ?? "Alle"}</span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  );
                })}
              </div>

              {filterSections.map((section) => {
                if (openSecondaryFilterKey !== section.key) {
                  return null;
                }

                return (
                  <div
                    key={section.key}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-2"
                  >
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {section.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {section.options.map((option) => {
                        const active = section.activeKey === option.key;

                        return (
                          <button
                            key={option.key}
                            onClick={() => section.onChange(option.key)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              active
                                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>{option.label}</span>
                            {typeof option.count === "number" && (
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                                  active
                                    ? "bg-white/20 text-white"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {option.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filters.map((filter) => {
                const active = activeFilter === filter.key;

                return (
                  <button
                    key={filter.key}
                    onClick={() => onFilterChange(filter.key)}
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
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <div
              className={
                isCompact
                  ? `overflow-hidden rounded-md border border-slate-200 bg-white ${
                      compactRowsWithMeta ? "divide-y divide-slate-200" : "divide-y divide-slate-100"
                    }`
                  : "space-y-2"
              }
            >
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
                    className={
                      isCompact
                        ? `group relative w-full text-left transition-colors ${
                            selected
                              ? "bg-blue-50/60"
                              : "bg-white hover:bg-slate-50"
                          }`
                        : `w-full rounded-lg border text-left transition-all ${
                            selected
                              ? "border-blue-200 bg-blue-50/60 shadow-sm shadow-blue-100/60"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                          } px-4 py-3`
                    }
                  >
                    {isCompact ? (
                      <div className="relative px-3 py-2.5">
                        <div
                          className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full ${
                            selected ? "bg-blue-600" : "bg-transparent"
                          }`}
                        />

                        <div className="flex items-start gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div
                              className={`truncate text-[13px] font-semibold leading-5 ${
                                selected ? "text-slate-950" : "text-slate-900"
                              }`}
                            >
                              {item.title}
                            </div>

                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              <Circle
                                size={6}
                                fill="currentColor"
                                className={stepTone.dot}
                              />
                              <span>{item.stepLabel}</span>
                              <span className="text-slate-300">{"\u2022"}</span>
                              <span>{item.status}</span>
                            </div>
                          </div>

                          <ChevronRight
                            size={15}
                            className={`mt-0.5 shrink-0 transition-colors ${
                              selected
                                ? "text-blue-600"
                                : "text-slate-300 group-hover:text-slate-400"
                            }`}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-sm font-semibold leading-5 text-slate-900"
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
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-600"
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
                      </>
                    )}

                    {(showItemMeta || isCompact) &&
                      (item.quantityValue ||
                        typeof item.progress ===
                          "number") && (
                      <div
                        className={`flex items-center justify-between gap-4 border-t pt-3 ${
                          isCompact
                            ? "mt-2 border-slate-100"
                            : "mt-3 border-slate-100"
                        } ${isCompact ? "px-3 pb-2.5" : ""}`}
                      >
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
