import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import 
{ 
  LayoutDashboard,
  Clipboard,
  Archive,
  Plug,
} from "lucide-react";

import { heeftDashboard, TAKEN_ROLLEN } from "../auth/authConfig";
import { useSessionUser } from "../auth/useSessionUser";
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


export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapseTimerRef = useRef<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { user } = useSessionUser();
  const toontTaken = TAKEN_ROLLEN.some((rol) => user.roles.includes(rol));
  const toontStekkers = user.roles.includes("functioneel_beheerder");
  const toontDashboard = heeftDashboard(user.roles);

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const collapseWithDelay = () => {
    clearCollapseTimer();

    collapseTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      collapseTimerRef.current = null;
    }, AUTO_COLLAPSE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearCollapseTimer();
    };
  }, []);

  const revealSidebar = () => {
    clearCollapseTimer();

    setIsExpanded(true);
  };

  const navigateFromSidebar = (path: string) => {
    revealSidebar();
    navigate(path);
  };

  return (
    <div
      onMouseEnter={revealSidebar}
      onMouseLeave={collapseWithDelay}
      className={`relative h-full shrink-0 border-r border-gray-200 bg-white shadow-sm transition-[width] duration-200 ease-out ${
        isExpanded ? "w-64" : "w-[4.5rem]"
      }`}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">
        <button
          type="button"
          onClick={revealSidebar}
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
          {toontDashboard ? (
            <SidebarItem
              label="Dashboard"
              icon={<LayoutDashboard />}
              active={location.pathname.startsWith("/dashboard")}
              expanded={isExpanded}
              onClick={() => navigateFromSidebar("/dashboard")}
            />
          ) : null}

          {toontTaken ? (
            <>
              <SidebarItem
                label="Taken"
                icon={<Clipboard />}
                active={
                  location.pathname.startsWith("/taken") ||
                  location.pathname.startsWith("/taak/")
                }
                expanded={isExpanded}
                onClick={() => navigateFromSidebar("/taak/1")}
              />

              <SidebarItem
                label="Archief"
                icon={<Archive />}
                active={location.pathname.startsWith("/taakdefinities")}
                expanded={isExpanded}
              />
            </>
          ) : null}

          {toontStekkers ? (
            <SidebarItem
              label="Stekkers"
              icon={<Plug />}
              active={location.pathname.startsWith("/stekkers")}
              expanded={isExpanded}
              onClick={() => navigateFromSidebar("/stekkers")}
            />
          ) : null}
        </div>

        <div className="flex-1" />

        <div className="mt-auto">
          <SidebarFooter expanded={isExpanded} onUserClick={revealSidebar} />
        </div>
      </div>
    </div>
  );
}
