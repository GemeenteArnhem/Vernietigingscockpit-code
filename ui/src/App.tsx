import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AppShell from "./layouts/AppShell";
import AppShellWithTaskSidebarAndContextSidebar from "./layouts/AppShellWithContextSidebar";

import DashboardPage from "./pages/DashboardPage";
import DestructionResultPage from "./pages/DestructionResultPage";
import TaskDefinitionDetailPage from "./pages/TaskDefinitionDetailPage";
import RecordDestructionPage from "./pages/RecordDestructionPage";
import RecordSelectionPage from "./pages/RecordSelectionPage";

import ArchivistApprovalPage from "./pages/ArchivistApprovalPage";
import ProcessOwnerApprovalPage from "./pages/ProcessOwnerApprovalPage";
import RecordReviewPage from "./pages/RecordReviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* DEFAULT */}
        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* DASHBOARD */}
        <Route
          element={<AppShell />}
        >
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />
          <Route
            path="/taak/:id"
            element={
              <TaskDefinitionDetailPage />
            }
          />
        <Route
          path="/taak/:taakId/taakuitvoering/:id/selectie"
          element={
            <RecordSelectionPage />
          }
        />
        <Route
          path="/taak/:taakId/taakuitvoering/:id/beoordeling"
          element={
            <RecordReviewPage />
          }
        />
      </Route>

      {/* TAAKUITVOERING MET RECHTERSIDEBAR */}
      <Route
        element={
          <AppShellWithTaskSidebarAndContextSidebar />
        }
      >
        <Route
          path="/taak/:taakId/taakuitvoering/:id/accordering/proceseigenaar"
          element={
            <ProcessOwnerApprovalPage />
            }
          />
          <Route
            path="/taak/:taakId/taakuitvoering/:id/accordering/archivaris"
            element={
              <ArchivistApprovalPage />
            }
          />
          <Route
            path="/taak/:taakId/taakuitvoering/:id/uitvoering"
            element={
              <RecordDestructionPage />
            }
          />
          <Route
            path="/taak/:taakId/taakuitvoering/:id/resultaat"
            element={
              <DestructionResultPage />
            }
          />
        </Route>

        {/* NORMAL LAYOUT */}
        <Route
          element={<AppShell />}
        >
          <Route
            path="/taak/:taakId/taakuitvoering/:id"
            element={
              <Navigate
                to="selectie"
                replace
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
