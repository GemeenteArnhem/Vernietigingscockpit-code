type Props = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  expanded?: boolean;
  onClick?: () => void;
};

export default function SidebarItem({
  label,
  icon,
  active,
  expanded = false,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-md px-4 py-2 cursor-pointer
      ${active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}
    >
      {/* actieve indicator */}
      {active && (
        <div className="absolute left-0 top-0 h-full w-1 bg-blue-600 rounded-r" />
      )}

      {/* icon */}
      <div className="w-5 h-5 flex items-center justify-center">
        {icon}
      </div>

      {/* label */}
      <span
        className={`whitespace-nowrap text-sm font-medium transition-opacity duration-150 ${
          expanded ? "opacity-100" : "opacity-0"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
