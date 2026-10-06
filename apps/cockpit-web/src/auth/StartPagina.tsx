import { Navigate } from "react-router-dom";

import DashboardPage from "../pages/DashboardPage";
import { heeftDashboard, TAKEN_STARTPAGINA } from "./authConfig";
import { useSessionUser } from "./useSessionUser";

// Startpagina na inloggen: het dashboard, of Taken voor wie geen werkvoorraad heeft
// (de functioneel beheerder).
export default function StartPagina() {
  const { user } = useSessionUser();

  if (!heeftDashboard(user.roles)) {
    return <Navigate to={TAKEN_STARTPAGINA} replace />;
  }

  return <DashboardPage />;
}
