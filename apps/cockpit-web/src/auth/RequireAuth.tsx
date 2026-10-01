import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "react-oidc-context";

import { authEnabled } from "./authConfig";

type Props = {
  children: ReactNode;
};

export default function RequireAuth({ children }: Props) {
  if (!authEnabled) {
    return children;
  }

  return <OidcRequireAuth>{children}</OidcRequireAuth>;
}

function OidcRequireAuth({ children }: Props) {
  const auth = useAuth();

  useEffect(() => {
    if (
      !auth.isLoading &&
      !auth.isAuthenticated &&
      !auth.activeNavigator &&
      !auth.error
    ) {
      void auth.signinRedirect();
    }
  }, [auth]);

  if (auth.isLoading || auth.activeNavigator) {
    return <AuthState message="Bezig met inloggen..." />;
  }

  if (auth.error) {
    return (
      <AuthState
        title="Inloggen mislukt"
        message={auth.error.message}
      />
    );
  }

  if (!auth.isAuthenticated) {
    return <AuthState message="Je wordt doorgestuurd naar de login." />;
  }

  return children;
}

function AuthState({
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
