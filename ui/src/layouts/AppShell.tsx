import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";

export default function AppShell() {
  const location = useLocation();

  const isTaskPage =
    location.pathname.startsWith(
      "/taak/"
    );

  const title = isTaskPage
    ? "Taken"
    : "Dashboard";

  const breadcrumbs = isTaskPage
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
