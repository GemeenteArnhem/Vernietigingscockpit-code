import { useAuth } from "react-oidc-context";
import { Navigate } from "react-router-dom";

import { authEnabled } from "./authConfig";

export default function AuthCallbackPage() {
  if (!authEnabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return <OidcAuthCallbackPage />;
}

function OidcAuthCallbackPage() {
  const auth = useAuth();

  if (auth.error) {
    return (
      <AuthCallbackState
        title="Inloggen mislukt"
        message={auth.error.message}
      />
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AuthCallbackState message="Login wordt afgerond..." />;
}

function AuthCallbackState({
  title = "Vernietigingscockpit",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}
