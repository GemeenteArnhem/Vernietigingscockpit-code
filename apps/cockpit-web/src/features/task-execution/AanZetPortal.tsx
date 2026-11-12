import type { ReactNode } from "react";

import ActionPanel, { ActionPanelEmptyState } from "../../components/ActionPanel";
import { AppShellPortal } from "../../layouts/AppShellPortalContext";
import type { Meekijken } from "./useMeekijken";

// Het actiepaneel (en de sneltoetsen) alleen voor wie aan zet is; anders de meekijkmelding
// in het bestaande lege-staat-blok van het actiepaneel.
export default function AanZetPortal({
  slot,
  meekijken,
  children,
}: {
  slot: "action" | "shortcut";
  meekijken: Meekijken;
  children: ReactNode;
}) {
  if (meekijken.aanZet) {
    return <AppShellPortal slot={slot}>{children}</AppShellPortal>;
  }

  if (slot === "shortcut" || meekijken.aanZet === null) {
    return null;
  }

  return (
    <AppShellPortal slot="action">
      <ActionPanel
        embedded
        title="Actie"
        titleClassName="text-sm"
        hideHeaderBorder
        hideFooterBorder
        bodyPaddingYClass="py-0"
      >
        <ActionPanelEmptyState title="Je kijkt mee" description={meekijken.melding} />
      </ActionPanel>
    </AppShellPortal>
  );
}
