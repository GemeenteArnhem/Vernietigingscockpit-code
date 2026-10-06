import { createContext, useContext } from "react";

// Context en hook staan los van de componenten in AppShellPortalContext.tsx,
// zodat dat bestand alleen componenten exporteert (nodig voor React Fast Refresh).

export type AppShellSlot = "detail" | "action" | "shortcut";

export type SlotContainers = {
  detail: HTMLDivElement | null;
  action: HTMLDivElement | null;
  shortcut: HTMLDivElement | null;
};

export type SlotCounts = {
  detail: number;
  action: number;
  shortcut: number;
};

export type AppShellPortalContextValue = {
  containers: SlotContainers;
  hasDetailPane: boolean;
  hasActionPane: boolean;
  hasShortcutPane: boolean;
  registerSlot: (slot: AppShellSlot) => void;
  unregisterSlot: (slot: AppShellSlot) => void;
  setSlotContainer: (
    slot: AppShellSlot,
    node: HTMLDivElement | null
  ) => void;
};

export const AppShellPortalContext =
  createContext<AppShellPortalContextValue | null>(null);

export function useAppShellPortalContext() {
  const context = useContext(AppShellPortalContext);

  if (!context) {
    throw new Error(
      "useAppShellPortalContext must be used within AppShellPortalProvider."
    );
  }

  return context;
}
