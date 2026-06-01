import { Outlet, matchPath, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import { reviewRows } from "../shared/mocks/reviewRows";

export default function AppShell() {
  const location = useLocation();

  const isTaskPage =
    location.pathname.startsWith(
      "/taak/"
    );

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

  return (
    <div className="flex h-screen">

      {/* LEFT BAR */}
      <Sidebar />

      {/* MAIN AREA */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* HEADER (MOET RUIMTE HEBBEN) */}
        <div className="shrink-0 border-b border-gray-200 bg-white">
          <div className="px-5 py-4">
            <PageHeader
              title={title}
              breadcrumbs={
                breadcrumbs
              }
            />
          </div>
        </div>

        {/* BODY */}
        <main className="flex flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
