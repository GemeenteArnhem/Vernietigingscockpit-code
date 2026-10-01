import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AppShell from "./layouts/AppShell";
import AuthCallbackPage from "./auth/AuthCallbackPage";
import RequireAuth from "./auth/RequireAuth";
import RequireRole from "./auth/RequireRole";

import DashboardPage from "./pages/DashboardPage";
import DestructionResultPage from "./pages/DestructionResultPage";
import TaskDefinitionCreatePage from "./pages/TaskDefinitionCreatePage";
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
          path="/auth/callback"
          element={<AuthCallbackPage />}
        />

        <Route
          element={<AppShell />}
        >
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/taak/nieuw"
            element={
              <RequireAuth>
                <TaskDefinitionCreatePage />
              </RequireAuth>
            }
          />
          <Route
            path="/taak/:id"
            element={
              <RequireAuth>
                <TaskDefinitionDetailPage />
              </RequireAuth>
            }
          />
        <Route
          path="/taak/:taakId/taakuitvoering/:id/selectie"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["recordmanager"]}>
                <RecordSelectionPage />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/taak/:taakId/taakuitvoering/:id/beoordeling"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["recordmanager"]}>
                <RecordReviewPage />
              </RequireRole>
            </RequireAuth>
          }
        />
      </Route>

      {/* TAAKUITVOERING MET RECHTERSIDEBAR */}
      <Route
        element={<AppShell />}
      >
          <Route
          path="/taak/:taakId/taakuitvoering/:id/accordering/proceseigenaar"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={["proceseigenaar"]}>
                <ProcessOwnerApprovalPage />
              </RequireRole>
            </RequireAuth>
            }
          />
          <Route
            path="/taak/:taakId/taakuitvoering/:id/accordering/archivaris"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={["archivaris"]}>
                  <ArchivistApprovalPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/taak/:taakId/taakuitvoering/:id/uitvoering"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={["recordmanager"]}>
                  <RecordDestructionPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/taak/:taakId/taakuitvoering/:id/resultaat"
            element={
              <RequireAuth>
                <DestructionResultPage />
              </RequireAuth>
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
              <RequireAuth>
                <Navigate
                  to="selectie"
                  replace
                />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
