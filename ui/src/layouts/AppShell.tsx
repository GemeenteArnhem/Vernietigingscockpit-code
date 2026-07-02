import { useCallback } from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import RightRail from "../components/RightRail";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import { reviewRows } from "../shared/mocks/reviewRows";
import {
  AppShellPortalProvider,
  useAppShellPortalContext,
} from "./AppShellPortalContext";

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
    ? reviewRows.find((row) => row.id === taskExecutionMatch.params.id)?.titel ??
      "Taakuitvoering"
    : null;

  const title = taskExecutionTitle ?? (isTaskPage ? "Taken" : "Dashboard");

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
        !isDashboardPage ? (
          <div className="shrink-0 border-b border-gray-200 bg-white">
            <div className="flex h-[69px] items-center px-5">
              <PageHeader
                title={title}
                breadcrumbs={
                  breadcrumbs
                }
              />
            </div>
          </div>
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
