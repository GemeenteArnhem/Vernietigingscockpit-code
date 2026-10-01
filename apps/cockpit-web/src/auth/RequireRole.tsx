import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { AppRole } from "./authConfig";
import { useSessionUser } from "./useSessionUser";

type Props = {
  allowedRoles: AppRole[];
  children: ReactNode;
};

export default function RequireRole({ allowedRoles, children }: Props) {
  const { user } = useSessionUser();
  const location = useLocation();
  const isAllowed = allowedRoles.some((role) => user.roles.includes(role));

  if (!isAllowed) {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ deniedPath: location.pathname }}
      />
    );
  }

  return children;
}
