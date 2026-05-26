import {
  Outlet,
} from "react-router-dom";

import Sidebar from "../components/Sidebar";

export default function AppShell() {
  return (
    <div className="flex h-screen">

      <Sidebar />

      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto px-5 pb-5 pt-0">
          <Outlet />
        </div>
      </main>

    </div>
  );
}