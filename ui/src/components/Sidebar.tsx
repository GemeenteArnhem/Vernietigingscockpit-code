import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import 
{ 
  LayoutDashboard,
  Clipboard,
  Archive,
} from "lucide-react";

import SidebarFooter from "./SidebarFooter";
import SidebarItem from "./SidebarItem";

const AUTO_COLLAPSE_DELAY_MS = 1800;

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full">
    <path
      d="M12 2L4 5V11C4 16.5 7.5 21 12 22C16.5 21 20 16.5 20 11V5L12 2Z"
      fill="#ffffff"
    />
    <path
      d="M12 2L4 5V11C4 16.5 7.5 21 12 22C16.5 21 20 16.5 20 11V5L12 2Z"
      stroke="#2563EB"
      strokeWidth="2.8"
      fill="none"
    />
    <path
      d="M12 2L20 5V11C20 16.5 16.5 21 12 22"
      stroke="#60A5FA"
      strokeWidth="2.8"
      fill="none"
    />
  </svg>
);


function shouldAutoCollapse(pathname: string) {
  return (
    /^\/taak\/[^/]+$/.test(pathname) ||
    pathname.includes("/dashboard") ||
    pathname.includes("/selectie") ||
    pathname.includes("/beoordeling") ||
    pathname.includes("/accordering")
  );
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapseTimerRef = useRef<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
    }

    setIsExpanded(true);

    if (shouldAutoCollapse(location.pathname)) {
      collapseTimerRef.current = window.setTimeout(() => {
        setIsExpanded(false);
        collapseTimerRef.current = null;
      }, AUTO_COLLAPSE_DELAY_MS);
    }

    return () => {
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [location.pathname]);

  const handleToggle = () => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }

    setIsExpanded((current) => !current);
  };

  return (
    <div
      className={`relative h-full shrink-0 border-r border-gray-200 bg-white shadow-sm transition-[width] duration-200 ease-out ${
        isExpanded ? "w-64" : "w-[4.5rem]"
      }`}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">
        <button
          type="button"
          onClick={handleToggle}
          className="mx-2 mt-2 flex items-center gap-3 rounded-md px-4 py-2 text-left hover:bg-gray-50"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ShieldIcon />
          </div>

          <div
            className={`whitespace-nowrap text-sm font-semibold text-gray-900 transition-opacity duration-150 ${
              isExpanded ? "opacity-100" : "opacity-0"
            }`}
          >
            Vernietigingscockpit
          </div>
        </button>

        <div className="mt-2 flex flex-col gap-1 px-2">
          <SidebarItem
            label="Dashboard"
            icon={<LayoutDashboard />}
            active={location.pathname.startsWith("/dashboard")}
            expanded={isExpanded}
            onClick={() => navigate("/dashboard")}
          />

          <SidebarItem
            label="Taken"
            icon={<Clipboard />}
            active={
              location.pathname.startsWith("/taken") ||
              location.pathname.startsWith("/taak/")
            }
            expanded={isExpanded}
            onClick={() => navigate("/taak/1")}
          />

          <SidebarItem
            label="Archief"
            icon={<Archive />}
            active={location.pathname.startsWith("/taakdefinities")}
            expanded={isExpanded}
          />
        </div>

        <div className="flex-1" />

        <div className="mt-auto">
          <SidebarFooter expanded={isExpanded} />
        </div>
      </div>
    </div>
  );
}
