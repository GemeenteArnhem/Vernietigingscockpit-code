export type TabItem = {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
};

type Props = {
  tabs: TabItem[];

  activeTab: string;

  onChange: (
    tabId: string
  ) => void;

  className?: string;
};

export default function Tabs({
  tabs,
  activeTab,
  onChange,
  className = "",
}: Props) {
  return (
    <div
      className={`
        border-b
        border-gray-200
        ${className}
      `}
    >
      <div
        className="
          flex
          items-center
          gap-8
        "
      >
        {tabs.map((tab) => {
          const active =
            activeTab ===
            tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={
                tab.disabled
              }
              onClick={() =>
                onChange(
                  tab.id
                )
              }
              className={`
                relative
                flex
                items-center
                gap-2
                h-10
                text-sm
                font-medium
                whitespace-nowrap
                transition-colors

                ${
                  active
                    ? `
                      text-blue-600
                    `
                    : `
                      text-gray-600
                      hover:text-gray-900
                    `
                }

                ${
                  tab.disabled
                    ? `
                      opacity-50
                      cursor-not-allowed
                    `
                    : ""
                }
              `}
            >
              {/* LABEL */}
              <span>
                {tab.label}
              </span>

              {/* COUNT */}
              {typeof tab.count ===
                "number" && (
                <span
                  className={`
                    inline-flex
                    items-center
                    justify-center
                    min-w-[20px]
                    h-5
                    px-1.5
                    rounded-full
                    text-[11px]
                    font-medium

                    ${
                      active
                        ? `
                          bg-blue-50
                          text-blue-700
                        `
                        : `
                          bg-gray-100
                          text-gray-500
                        `
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}

              {/* ACTIVE UNDERLINE */}
              {active && (
                <div
                  className="
                    absolute
                    left-0
                    right-0
                    bottom-0
                    h-[2px]
                    bg-blue-600
                  "
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}