import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  AppShellPortalContext,
  useAppShellPortalContext,
  type AppShellPortalContextValue,
  type AppShellSlot,
  type SlotContainers,
  type SlotCounts,
} from "./appShellPortalState";

function isPaneEmpty(children: ReactNode) {
  return children === null || children === undefined || children === false;
}

export function AppShellPortalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [containers, setContainers] = useState<SlotContainers>({
    detail: null,
    action: null,
    shortcut: null,
  });
  const [slotCounts, setSlotCounts] = useState<SlotCounts>({
    detail: 0,
    action: 0,
    shortcut: 0,
  });

  const registerSlot = useCallback((slot: AppShellSlot) => {
    setSlotCounts((current) => ({
      ...current,
      [slot]: current[slot] + 1,
    }));
  }, []);

  const unregisterSlot = useCallback((slot: AppShellSlot) => {
    setSlotCounts((current) => ({
      ...current,
      [slot]: Math.max(0, current[slot] - 1),
    }));
  }, []);

  const setSlotContainer = useCallback(
    (slot: AppShellSlot, node: HTMLDivElement | null) => {
      setContainers((current) => {
        if (current[slot] === node) {
          return current;
        }

        return {
          ...current,
          [slot]: node,
        };
      });
    },
    []
  );

  const value = useMemo<AppShellPortalContextValue>(
    () => ({
      containers,
      hasDetailPane: slotCounts.detail > 0,
      hasActionPane: slotCounts.action > 0,
      hasShortcutPane: slotCounts.shortcut > 0,
      registerSlot,
      unregisterSlot,
      setSlotContainer,
    }),
    [containers, registerSlot, setSlotContainer, slotCounts, unregisterSlot]
  );

  return (
    <AppShellPortalContext.Provider value={value}>
      {children}
    </AppShellPortalContext.Provider>
  );
}

export function AppShellPortal({
  slot,
  children,
}: {
  slot: AppShellSlot;
  children: ReactNode;
}) {
  const { containers, registerSlot, unregisterSlot } =
    useAppShellPortalContext();
  const hasContent = !isPaneEmpty(children);

  useEffect(() => {
    if (!hasContent) {
      return;
    }

    registerSlot(slot);

    return () => {
      unregisterSlot(slot);
    };
  }, [hasContent, registerSlot, slot, unregisterSlot]);

  const container = containers[slot];

  if (!hasContent || !container) {
    return null;
  }

  return createPortal(children, container);
}
