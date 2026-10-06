import { useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import RightRail from "../components/RightRail";
import Sidebar from "../components/Sidebar";
import PageHeaderBar from "../components/PageHeaderBar";
import { AppShellPortalProvider } from "./AppShellPortalContext";
import { useAppShellPortalContext } from "./appShellPortalState";

export default function AppShell() {
  return (
    <AppShellPortalProvider>
      <AppShellLayout />
    </AppShellPortalProvider>
  );
}

function AppShellLayout() {
  const location = useLocation();
  const {
    hasActionPane,
    hasDetailPane,
    hasShortcutPane,
    setSlotContainer,
  } = useAppShellPortalContext();

  const isTaskPage =
    location.pathname.startsWith(
      "/taak/"
    );
  const isDashboardPage =
    location.pathname ===
    "/dashboard";

  const taskExecutionMatch =
    matchPath("/taak/:taakId/taakuitvoering/:id/selectie", location.pathname) ??
    matchPath("/taak/:taakId/taakuitvoering/:id/beoordeling", location.pathname) ??
    matchPath("/taak/:taakId/taakuitvoering/:id/accordering/proceseigenaar", location.pathname) ??
    matchPath("/taak/:taakId/taakuitvoering/:id/accordering/archivaris", location.pathname) ??
    matchPath("/taak/:taakId/taakuitvoering/:id/uitvoering", location.pathname) ??
    matchPath("/taak/:taakId/taakuitvoering/:id/resultaat", location.pathname) ??
    matchPath("/taak/:taakId/taakuitvoering/:id", location.pathname);

  const taskExecutionTitle = taskExecutionMatch
    ? "Taakuitvoering"
    : null;

  const isStekkerPage = location.pathname.startsWith("/stekkers");
  // Net als het dashboard hebben deze pagina's een eigen kop in het paneel.
  const heeftEigenKop = isStekkerPage || location.pathname === "/taak/nieuw";
  const title = taskExecutionTitle ?? (isTaskPage ? "Taken" : isStekkerPage ? "Stekkers" : "Dashboard");

  const breadcrumbs = taskExecutionTitle
    ? [
        { label: "Home", href: "/" },
        { label: "Taken" },
        { label: "Taakuitvoering" },
        { label: taskExecutionTitle },
      ]
    : isTaskPage
      ? [
          { label: "Home", href: "/" },
          { label: "Taken" },
        ]
      : isStekkerPage
        ? [
            { label: "Home", href: "/" },
            { label: "Stekkers" },
          ]
      : [
          { label: "Home", href: "/" },
          { label: "Dashboard" },
        ];

  const handleDetailPaneRef = useCallback(
    (node: HTMLDivElement | null) => {
      setSlotContainer("detail", node);
    },
    [setSlotContainer]
  );

  const handleActionPaneRef = useCallback(
    (node: HTMLDivElement | null) => {
      setSlotContainer("action", node);
    },
    [setSlotContainer]
  );

  const handleShortcutPaneRef = useCallback(
    (node: HTMLDivElement | null) => {
      setSlotContainer("shortcut", node);
    },
    [setSlotContainer]
  );

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        {!taskExecutionMatch &&
        !isDashboardPage &&
        !heeftEigenKop ? (
          <PageHeaderBar
            title={title}
            breadcrumbs={isTaskPage ? undefined : breadcrumbs}
            icon={
              isTaskPage ? (
                <ClipboardList size={24} strokeWidth={1.8} />
              ) : undefined
            }
          />
        ) : null}

        <main className="flex flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>

        {hasShortcutPane && <div ref={handleShortcutPaneRef} />}
      </div>

      <RightRail
        showDetailPane={hasDetailPane}
        showActionPane={hasActionPane}
        onDetailPaneRef={handleDetailPaneRef}
        onActionPaneRef={handleActionPaneRef}
      />
    </div>
  );
}
