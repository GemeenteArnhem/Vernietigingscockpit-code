import React from "react";

type Action = {
  label: string;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
  onClick?: () => void;
};

type Props = {
  titel: string;
  subtitel?: string;

  badge?: {
    label: string;
    color?: "blue" | "green" | "yellow" | "red" | "gray";
  };

  actions?: Action[];
};

const badgeStyles = {
  blue:
    "border-blue-200 bg-blue-50 text-blue-600",

  green:
    "border-green-200 bg-green-50 text-green-700",

  yellow:
    "border-amber-200 bg-amber-50 text-amber-700",

  red:
    "border-red-200 bg-red-50 text-red-700",

  gray:
    "border-gray-200 bg-gray-50 text-gray-600",
};

export default function TaskHeader({
  titel,
  subtitel,
  badge,
  actions = [],
}: Props) {
  return (
    <div className="flex items-start justify-between border-b border-gray-200 pb-4">

      {/* LINKS */}
      <div>
        <div className="flex items-center gap-3">

          <h1 className="text-2xl font-semibold text-gray-900">
            {titel}
          </h1>

          {badge && (
            <span
              className={`
                px-2.5
                py-0.5
                text-sm
                rounded-md
                border
                ${
                  badgeStyles[
                    badge.color || "blue"
                  ]
                }
              `}
            >
              {badge.label}
            </span>
          )}

        </div>

        {subtitel && (
          <p className="text-gray-500 text-sm mt-1">
            {subtitel}
          </p>
        )}

      </div>

      {/* RECHTS */}
      {actions.length > 0 && (
        <div className="flex items-center gap-3 pt-1">

          {actions.map(
            (action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`
                  flex
                  items-center
                  gap-2
                  px-4
                  py-2
                  rounded-md
                  text-sm
                  transition-colors
                  
                  ${
                    action.variant ===
                    "primary"
                      ? `
                      bg-blue-600
                      text-white
                      hover:bg-blue-700
                    `
                      : `
                      border
                      border-gray-300
                      text-gray-700
                      hover:bg-gray-50
                    `
                  }
                `}
              >
                {action.label}
                {action.icon}
              </button>
            )
          )}

        </div>
      )}
    </div>
  );
}