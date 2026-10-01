import { useEffect, useState } from "react";

type ContextTab = "metadata" | "statistics" | "audit";

type MetadataItem = {
  label: string;
  value: string;
};

type StatisticItem = {
  label: string;
  value: string;
  tone: "blue" | "amber" | "red" | "green";
  hint?: string;
  progress?: number;
};

type AuditItem = {
  id: string;
  date: string;
  title: string;
  user: string;
  details?: string;
};

type Props = {
  metadata: MetadataItem[];
  statistics: StatisticItem[];
  auditItems: AuditItem[];
  positionClassName?: string;
  variant?: "floating" | "shell";
};

const SESSION_KEYS = {
  open: "vernietigingslijst-context-open",
  pinned: "vernietigingslijst-context-pinned",
  tab: "vernietigingslijst-context-tab",
};

const TAB_CONFIG: Array<{
  id: ContextTab;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  {
    id: "metadata",
    label: "Metadata",
    shortLabel: "Meta",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M6 5H18M6 12H18M6 19H13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "statistics",
    label: "Voortgang",
    shortLabel: "Stats",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M5 19V11M12 19V5M19 19V8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "audit",
    label: "Audit",
    shortLabel: "Audit",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path
          d="M12 7V12L15 14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
        />
      </svg>
    ),
  },
];

const toneStyles = {
  blue: {
    track: "bg-blue-100",
    fill: "bg-blue-600",
    pill: "bg-blue-50 text-blue-700",
  },
  amber: {
    track: "bg-amber-100",
    fill: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700",
  },
  red: {
    track: "bg-red-100",
    fill: "bg-red-500",
    pill: "bg-red-50 text-red-700",
  },
  green: {
    track: "bg-green-100",
    fill: "bg-green-600",
    pill: "bg-green-50 text-green-700",
  },
};

function loadSessionBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = window.sessionStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function loadSessionTab(): ContextTab {
  if (typeof window === "undefined") return "statistics";
  const value = window.sessionStorage.getItem(SESSION_KEYS.tab);
  if (value === "metadata" || value === "statistics" || value === "audit") {
    return value;
  }
  return "statistics";
}

export default function ContextPane({
  metadata,
  statistics,
  auditItems,
  positionClassName = "absolute inset-y-0 right-0",
  variant = "floating",
}: Props) {
  const [isOpen, setIsOpen] = useState(() =>
    loadSessionBoolean(SESSION_KEYS.open, false)
  );
  const [isPinned, setIsPinned] = useState(() =>
    loadSessionBoolean(SESSION_KEYS.pinned, false)
  );
  const [activeTab, setActiveTab] = useState<ContextTab>(loadSessionTab);
  const [expandedAuditIds, setExpandedAuditIds] = useState<string[]>([]);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEYS.open, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEYS.pinned, String(isPinned));
  }, [isPinned]);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEYS.tab, activeTab);
  }, [activeTab]);

  const activeTabLabel =
    TAB_CONFIG.find((tab) => tab.id === activeTab)?.label ?? "Context";

  const toggleAuditEntry = (id: string) => {
    setExpandedAuditIds((current) =>
      current.includes(id)
        ? current.filter((entryId) => entryId !== id)
        : [...current, id]
    );
  };

  const isShell = variant === "shell";
  const shellWidthClassName = isOpen ? "w-[404px]" : "w-16";

  return (
    <div
      className={`z-20 flex transition-[width] duration-200 ease-out ${
        isShell ? shellWidthClassName : "pointer-events-none"
      } ${positionClassName}`}
    >
      <div
        className={`pointer-events-auto flex ${
          isShell
            ? "h-full rounded-none border-l border-gray-200 bg-white shadow-none"
            : "rounded-2xl border border-gray-200 bg-white shadow-sm"
        } ${isShell ? "relative" : "absolute inset-y-0 right-0"}`}
      >
        <div
          className={`flex w-16 shrink-0 flex-col items-center justify-between border-r border-gray-200 py-4 ${
            isShell ? "bg-white" : "bg-gray-50/80"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsOpen(true);
                  }}
                  title={tab.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm transition-colors ${
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-white hover:text-gray-700"
                  }`}
                >
                  {tab.icon}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            title={isOpen ? "Paneel sluiten" : "Paneel openen"}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-gray-500 transition-colors hover:border-gray-200 hover:bg-white hover:text-gray-700"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              <path
                d="M9 6L15 12L9 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div
          className={`overflow-hidden transition-[width,opacity] duration-200 ease-out ${
            isOpen ? "w-[340px] opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="flex h-full w-[340px] flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400">
                  Context
                </p>
                <h2 className="mt-1 text-sm font-semibold text-gray-900">
                  {activeTabLabel}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinned((current) => !current)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isPinned
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {isPinned ? "Vastgezet" : "Zet vast"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isPinned) setIsOpen(false);
                  }}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  title="Sluiten"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      d="M6 6L18 18M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="border-b border-gray-200 px-2 py-2">
              <div className="flex gap-1">
                {TAB_CONFIG.map((tab) => {
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {tab.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              {activeTab === "metadata" && (
                <div className="grid gap-3">
                  {metadata.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-3"
                    >
                      <div className="text-xs font-medium uppercase tracking-[0.1em] text-gray-400">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm font-medium text-gray-900">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "statistics" && (
                <div className="space-y-4">
                  {statistics.map((item) => {
                    const tone = toneStyles[item.tone];

                    return (
                      <div
                        key={item.label}
                        className="rounded-xl border border-gray-200 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.value}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {item.label}
                            </div>
                          </div>

                          {item.hint && (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.pill}`}>
                              {item.hint}
                            </span>
                          )}
                        </div>

                        {typeof item.progress === "number" && (
                          <div className="mt-3">
                            <div className={`h-2 rounded-full ${tone.track}`}>
                              <div
                                className={`h-2 rounded-full ${tone.fill}`}
                                style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "audit" && (
                <div className="space-y-3">
                  {auditItems.map((item) => {
                    const isExpanded = expandedAuditIds.includes(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAuditEntry(item.id)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-gray-400">
                              {item.date}
                            </div>
                            <div className="mt-1 text-sm font-medium text-gray-900">
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {item.user}
                            </div>
                          </div>

                          <svg
                            viewBox="0 0 24 24"
                            className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <path
                              d="M6 9L12 15L18 9"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              fill="none"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        {isExpanded && item.details && (
                          <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                            {item.details}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
