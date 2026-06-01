import
{ 
    ChevronDown, 
    CircleHelp, 
    Settings 
} from "lucide-react";

type Props = {
  expanded?: boolean;
};

export default function SidebarFooter({
  expanded = false,
}: Props) {
  return (
    <div className="border-t border-gray-200 px-2 py-4">

      {/* USER */}
      <div className={`mb-4 flex w-full cursor-pointer items-center rounded-md py-2 hover:bg-gray-50 ${
        expanded ? "justify-between gap-3 px-2" : "justify-start px-4"
      }`}>

        <div className="flex min-w-0 items-center gap-3">
          {/* avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            JD
          </div>

          {/* name */}
          <span
            className={`overflow-hidden whitespace-nowrap text-sm font-medium text-gray-900 transition-all duration-150 ${
              expanded ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"
            }`}
          >
            Jan de Vries
          </span>
        </div>

        {/* chevron */}
        <span
          className={`shrink-0 text-gray-400 transition-all duration-150 ${
            expanded ? "opacity-100" : "w-0 opacity-0"
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </div>

      {/* MENU ITEMS */}
      <div className="flex flex-col gap-1">

        <SidebarFooterItem
          icon={<Settings className="w-5 h-5 text-slate-700" />}
          label="Instellingen"
          expanded={expanded}
        />

        <SidebarFooterItem
          icon={<CircleHelp className="w-5 h-5 text-slate-700" />}
          label="Help"
          expanded={expanded}
        />

      </div>
    </div>
  );
}

function SidebarFooterItem({
  icon,
  label,
  expanded = false,
}: {
  icon: React.ReactNode;
  label: string;
  expanded?: boolean;
}) {
  return (
    <div
      className={`flex cursor-pointer items-center rounded-md py-2 text-gray-700 hover:bg-gray-50 ${
        expanded ? "gap-3 px-2" : "justify-start px-4"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-500">
        {icon}
      </span>
      <span
        className={`overflow-hidden whitespace-nowrap text-sm transition-all duration-150 ${
          expanded ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
