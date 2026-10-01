const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M5 6V18C5 20 9 21 12 21C15 21 19 20 19 18V6" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      d="M12 3L2 20H22L12 3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <path d="M12 9V13" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="17" r="1" fill="currentColor" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      d="M5 13L10 18L19 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

type Stat = {
  label: string;
  value: string;
  sub?: string;
  color: Color;
  icon: React.ReactNode; 
};


const stats: Stat[] = [
  {
    label: "Totaal objecten",
    value: "1.248",
    color: "blue",
    icon: <DatabaseIcon />,
  },
  {
    label: "Uitgesloten",
    value: "148",
    sub: "11,9%",
    color: "orange",
    icon: <CloseIcon />,
  },
  {
    label: "Afwijkingen",
    value: "12",
    sub: "1,0%",
    color: "red",
    icon: <WarningIcon />,
  },
  {
    label: "Te beoordelen",
    value: "1.100",
    sub: "88,1%",
    color: "green",
    icon: <CheckIcon />,
  },
];

const colorMap = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-600",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-600",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
  },
};

type Color = keyof typeof colorMap;

const Icon = ({
  color,
  icon,
}: {
  color: Color;
  icon: React.ReactNode;
}) => {
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center ${colorMap[color].bg}`}
    >
      <div className={`${colorMap[color].text}`}>
        {icon}
      </div>
    </div>
  );
};

export default function StatsBar() {
  return (
    <div className="grid grid-cols-4 gap-3 mb-2">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-xl p-2 flex items-center gap-4"
        >
          {/* icon */}
          <Icon color={stat.color as Color} icon={stat.icon} />

          {/* content */}
          <div className="flex flex-col">
            <span className="text-sm text-gray-500">
              {stat.label}
            </span>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-semibold text-gray-900">
                {stat.value}
              </span>

              {stat.sub && (
                <span className="text-sm text-gray-400">
                  ({stat.sub})
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}