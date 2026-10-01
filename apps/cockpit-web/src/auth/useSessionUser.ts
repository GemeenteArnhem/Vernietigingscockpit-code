import { createContext, useContext } from "react";

import { devSessionUser } from "./authConfig";
import type { SessionUser } from "./authConfig";

export type SessionUserContextValue = {
  user: SessionUser;
  accessToken?: string;
  signOut?: () => void;
};

export const SessionUserContext = createContext<SessionUserContextValue>({
  user: devSessionUser,
});

export function useSessionUser() {
  return useContext(SessionUserContext);
}
