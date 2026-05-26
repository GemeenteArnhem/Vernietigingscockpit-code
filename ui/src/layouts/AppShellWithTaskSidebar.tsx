import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";

import TaskSidebar, {
  type TaskFilter,
  type TaskSidebarItem,
} from "../features/task-execution/components/TaskSidebar";

const mockTasks: TaskSidebarItem[] = [
  {
    id: "1",
    naam: "Zorgdomein jaarlijks",
    frequentie: "Jaarlijks",
    status: "actie-vereist",
    subtitle: "Beoordeling vereist",
  },
  {
    id: "2",
    naam: "HR vernietiging",
    frequentie: "Kwartaal",
    status: "lopend",
    subtitle:
      "Accordering PO",
  },
];

export default function AppShellWithTaskSidebar() {
  const [
    selectedTaskId,
    setSelectedTaskId,
  ] = useState("1");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<TaskFilter>("alle");

  const taskSidebarProps =
    useMemo(
      () => ({
        tasks: mockTasks,

        selectedTaskId,

        onSelectTask:
          setSelectedTaskId,

        search,

        onSearchChange:
          setSearch,

        activeFilter:
          filter,

        onFilterChange:
          setFilter,
      }),
      [
        selectedTaskId,
        search,
        filter,
      ]
    );

  return (
    <div className="flex h-screen">

      {/* LEFT NAV */}
      <Sidebar />

      {/* TASK SIDEBAR */}
      <TaskSidebar
        {...taskSidebarProps}
      />

      {/* PAGE CONTENT */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto px-5 pb-5 pt-0">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
