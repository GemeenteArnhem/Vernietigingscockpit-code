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

type ActionItem = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
};

type Props = {
  metadata: MetadataItem[];
  statistics: StatisticItem[];
  auditItems: AuditItem[];
  actions?: ActionItem[];

  /** CP open/closed gedrag (optioneel uitbreidbaar later) */
  defaultOpen?: boolean;
};

const SESSION_KEYS = {
  open: "cp-open",
  tab: "cp-tab",
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

function loadBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = window.sessionStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function loadTab(): ContextTab {
  if (typeof window === "undefined") return "statistics";
  const value = window.sessionStorage.getItem(SESSION_KEYS.tab);
  if (value === "metadata" || value === "statistics" || value === "audit") {
    return value;
  }
  return "statistics";
}

export default function ContextPanel({
  metadata,
  statistics,
  auditItems,
  actions = [],
  defaultOpen = true,
}: Props) {
  const [isOpen, setIsOpen] = useState(() =>
    loadBoolean(SESSION_KEYS.open, defaultOpen)
  );

  const [activeTab, setActiveTab] = useState<ContextTab>(loadTab);

  const [expandedAuditIds, setExpandedAuditIds] = useState<string[]>([]);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEYS.open, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEYS.tab, activeTab);
  }, [activeTab]);

  const toggleAuditEntry = (id: string) => {
    setExpandedAuditIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  };

  const activeTabLabel =
    TAB_CONFIG.find((t) => t.id === activeTab)?.label ?? "Context";

  return (
    <div
      className={`
        h-full border-l border-gray-200 bg-white flex
        transition-[width] duration-200 ease-out
        ${isOpen ? "w-[380px]" : "w-16"}
      `}
    >
      {/* LEFT ICON BAR */}
      <div className="w-16 shrink-0 border-r border-gray-200 flex flex-col items-center justify-between py-4 bg-gray-50">
        <div className="flex flex-col gap-2">
          {TAB_CONFIG.map((tab) => {
            const active = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsOpen(true);
                }}
                className={`
                  h-11 w-11 rounded-xl border flex items-center justify-center
                  transition-colors
                  ${
                    active
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "border-transparent text-gray-500 hover:bg-white hover:border-gray-200"
                  }
                `}
              >
                {tab.icon}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsOpen((v) => !v)}
          className="h-11 w-11 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 text-gray-500"
        >
          <svg viewBox="0 0 24 24" className={`h-5 w-5 ${isOpen ? "rotate-180" : ""}`}>
            <path
              d="M9 6L15 12L9 18"
              stroke="currentColor"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* CONTENT */}
      {isOpen && (
        <div className="flex flex-col w-[320px] min-w-0">

          {/* HEADER */}
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="text-xs uppercase text-gray-400">Context</div>
            <div className="text-sm font-semibold text-gray-900">
              {activeTabLabel}
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-1 border-b border-gray-200 px-2 py-2">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-3 py-2 text-sm rounded-lg
                  ${
                    tab.id === activeTab
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {tab.shortLabel}
              </button>
            ))}
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-auto px-4 py-4">

            {activeTab === "metadata" && (
              <div className="space-y-3">
                {metadata.map((m) => (
                  <div key={m.label} className="border rounded-xl bg-gray-50 p-3">
                    <div className="text-xs text-gray-400 uppercase">
                      {m.label}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "statistics" && (
              <div className="space-y-3">
                {statistics.map((s) => {
                  const tone = toneStyles[s.tone];

                  return (
                    <div key={s.label} className="border rounded-xl p-3">
                      <div className="text-sm font-medium">{s.value}</div>
                      <div className="text-sm text-gray-500">{s.label}</div>

                      {s.hint && (
                        <div className={`mt-2 inline-block text-xs px-2 py-1 rounded-full ${tone.pill}`}>
                          {s.hint}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "audit" && (
              <div className="space-y-3">
                {auditItems.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toggleAuditEntry(a.id)}
                    className="w-full border rounded-xl p-3 text-left hover:bg-gray-50"
                  >
                    <div className="text-xs text-gray-400">{a.date}</div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-gray-500">{a.user}</div>

                    {expandedAuditIds.includes(a.id) && a.details && (
                      <div className="mt-2 text-sm text-gray-600 border-t pt-2">
                        {a.details}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

          </div>

          {/* ACTIONS (nieuw concept) */}
          {actions.length > 0 && (
            <div className="border-t border-gray-200 p-3 space-y-2">
              <div className="text-xs uppercase text-gray-400">
                Acties
              </div>

              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className="w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}