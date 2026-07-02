import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  RotateCcw,
} from "lucide-react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelSection,
} from "../components/ActionPanel";
import ContentPanel from "../components/ContentPanel";
import ShortcutPane from "../components/ShortcutPane";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  destructionConnectors,
  destructionSummaryStats,
  destructionTaskMetaItems,
} from "../shared/mocks/recordDestructionPage";
import { reviewSummaryStatusStyles } from "../shared/ui/reviewStatusStyles";
import type {
  TaskExecutionConnectorDestructionStatus,
  TaskExecutionDestructionConnector,
} from "../shared/types/taskExecutionConnector";

type DestructionActionId =
  | "vernietiging-uitvoeren"
  | "herkansen";

function getVernietigingsStatusLabel(status: TaskExecutionConnectorDestructionStatus) {
  switch (status) {
    case "NIET_GESTART":
      return "Niet gestart";
    case "BEZIG":
      return "Bezig";
    case "VOLTOOID":
      return "Voltooid";
    case "GEDEELTELIJK_VOLTOOID":
      return "Gedeeltelijk voltooid";
  }
}

function getVoortgangskleur(status: TaskExecutionConnectorDestructionStatus) {
  switch (status) {
    case "VOLTOOID":
      return reviewSummaryStatusStyles.akkoord.progress;
    case "GEDEELTELIJK_VOLTOOID":
      return reviewSummaryStatusStyles.retour.progress;
    case "BEZIG":
      return reviewSummaryStatusStyles.teBeoordelen.progress;
    case "NIET_GESTART":
      return reviewSummaryStatusStyles.uitgesteld.progress;
  }
}

function getConnectorStageCopy(status: TaskExecutionConnectorDestructionStatus) {
  switch (status) {
    case "VOLTOOID":
      return "Vernietiging afgerond";
    case "GEDEELTELIJK_VOLTOOID":
      return "Herstel nodig";
    case "BEZIG":
      return "Vernietiging loopt";
    case "NIET_GESTART":
      return "Wacht op start";
  }
}

function getConnectorStatusBadgeClasses(connector: TaskExecutionDestructionConnector) {
  if (connector.stekkerStatus === "FOUT") {
    return reviewSummaryStatusStyles.uitgesloten.badge;
  }

  return reviewSummaryStatusStyles.akkoord.badge;
}

function getStekkerStatusBadgeClass(
  connector: TaskExecutionDestructionConnector
) {
  return connector.stekkerStatus === "FOUT"
    ? reviewSummaryStatusStyles.uitgesloten.badge
    : reviewSummaryStatusStyles.akkoord.badge;
}

export default function RecordDestructionPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const [selectedConnectorId, setSelectedConnectorId] = useState(
    destructionConnectors[0]?.id ?? null
  );
  const [selectedAction, setSelectedAction] = useState<DestructionActionId>(
    "vernietiging-uitvoeren"
  );

  const selectedConnector =
    destructionConnectors.find((connector) => connector.id === selectedConnectorId) ??
    destructionConnectors[0];

  const selectedConnectorIndex = useMemo(
    () => destructionConnectors.findIndex((connector) => connector.id === selectedConnector.id),
    [selectedConnector]
  );

  const previousConnector =
    selectedConnectorIndex > 0
      ? destructionConnectors[selectedConnectorIndex - 1]
      : undefined;
  const nextConnector =
    selectedConnectorIndex >= 0 && selectedConnectorIndex < destructionConnectors.length - 1
      ? destructionConnectors[selectedConnectorIndex + 1]
      : undefined;

  const selectedConnectorNeedsRetry =
    selectedConnector.vernietigingsStatus === "GEDEELTELIJK_VOLTOOID" ||
    selectedConnector.stekkerStatus === "FOUT";

  const handlePrimaryAction = () => {
    if (
      selectedAction === "herkansen" &&
      !selectedConnectorNeedsRetry
    ) {
      return;
    }

    navigate(`/taak/${taakId}/taakuitvoering/${id}/resultaat`);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isTyping =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key.toLowerCase() === "w") {
        event.preventDefault();

        if (selectedAction === "herkansen" && !selectedConnectorNeedsRetry) {
          return;
        }

        navigate(`/taak/${taakId}/taakuitvoering/${id}/resultaat`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, navigate, selectedAction, selectedConnectorNeedsRetry, taakId]);

  return (
    <>
      <AppShellPortal slot="detail">
        <RecordDetailsPanel
          heading="Stekkerdetails"
          record={{ titel: selectedConnector.naam }}
          comments={[]}
          showTabs={false}
          currentIndex={selectedConnectorIndex >= 0 ? selectedConnectorIndex + 1 : 0}
          totalCount={destructionConnectors.length}
          onPrevious={
            previousConnector
              ? () => setSelectedConnectorId(previousConnector.id)
              : undefined
          }
          onNext={
            nextConnector
              ? () => setSelectedConnectorId(nextConnector.id)
              : undefined
          }
          details={[
            {
              label: "Stekkerstatus",
              value: selectedConnector.stekkerStatus === "SUCCES" ? "Gekoppeld" : "Fout",
              badgeClassName: getConnectorStatusBadgeClasses(selectedConnector),
            },
            {
              label: "Vernietigingsstatus",
              value: getVernietigingsStatusLabel(selectedConnector.vernietigingsStatus),
            },
            { label: "Versie", value: selectedConnector.versie },
            { label: "Laatste run", value: selectedConnector.laatsteRun },
            { label: "Te vernietigen objecten", value: selectedConnector.aantalObjecten },
            { label: "Voortgang", value: `${selectedConnector.voortgang}%` },
            {
              label: "Volgende stap",
              value: selectedConnectorNeedsRetry
                ? "Herkansen of foutanalyse"
                : "Wachten op afronding van alle vernietigingen",
            },
            {
              label: "Statusbeeld",
              value: getConnectorStageCopy(selectedConnector.vernietigingsStatus),
            },
            { label: "Melding", value: selectedConnector.melding },
          ]}
        />
      </AppShellPortal>

      <AppShellPortal slot="action">
        <ActionPanel
          embedded
          title="Actie"
          titleClassName="text-sm"
          hideHeaderBorder
          hideFooterBorder
          bodyPaddingYClass="py-0"
          footer={
            <ActionPanelButtonGroup>
              <ActionPanelButton
                label="Actie uitvoeren"
                variant="primary"
                disabled={
                  selectedAction === "herkansen" &&
                  !selectedConnectorNeedsRetry
                }
                onClick={handlePrimaryAction}
              />
            </ActionPanelButtonGroup>
          }
        >
          <ActionPanelSection
            title="Kies een actie"
          >
            <div className="space-y-3">
              <ActionPanelChoice
                title="Vernietiging uitvoeren"
                description=""
                icon={<ArrowRight size={18} />}
                tone="primary"
                density="compact"
                selected={selectedAction === "vernietiging-uitvoeren"}
                onClick={() => setSelectedAction("vernietiging-uitvoeren")}
              />

              <ActionPanelChoice
                title={`Herkansen voor ${selectedConnector.naam}`}
                description=""
                icon={<RotateCcw size={18} />}
                tone={selectedConnectorNeedsRetry ? "warning" : "neutral"}
                density="compact"
                selected={selectedAction === "herkansen"}
                onClick={() => setSelectedAction("herkansen")}
              />
            </div>
          </ActionPanelSection>
        </ActionPanel>
      </AppShellPortal>

      <AppShellPortal slot="shortcut">
        <ShortcutPane
          shortcuts={[
            { keyLabel: "W", label: "Actie uitvoeren" },
          ]}
        />
      </AppShellPortal>

      <ContentPanel>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <TaskExecutionHeader
            activeStep="UITVOERING"
            summaryStats={destructionSummaryStats}
            metaItems={destructionTaskMetaItems}
            showStatusOverview={false}
          />

          <div className="flex min-w-0 w-full flex-1 flex-col">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
              <div className="min-h-0 flex-1 overflow-auto">
                <table
                  className="w-full table-fixed text-sm"
                  role="grid"
                  aria-label="Beschikbare stekkers"
                >
                  <thead className="bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="w-[30%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Stekker
                      </th>
                      <th className="w-[16%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Stekkerstatus
                      </th>
                      <th className="w-[38%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Voortgang
                      </th>
                      <th className="w-[16%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Objecten
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {destructionConnectors.map((connector) => {
                      const selected = connector.id === selectedConnector.id;

                      return (
                        <tr
                          key={connector.id}
                          tabIndex={0}
                          aria-selected={selected}
                          onClick={() => setSelectedConnectorId(connector.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedConnectorId(connector.id);
                            }
                          }}
                          className={`cursor-pointer border-b border-slate-100 transition focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:ring-inset hover:bg-sky-50/40 ${
                            selected ? "bg-sky-50/60" : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                {connector.icon}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-900">
                                  {connector.naam}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getStekkerStatusBadgeClass(connector)}`}
                            >
                              {connector.stekkerStatus === "SUCCES" ? "Gekoppeld" : "Fout"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                                <span className="truncate">
                                  {getConnectorStageCopy(connector.vernietigingsStatus)}
                                </span>
                                <span className="shrink-0">
                                  {connector.voortgang}%
                                </span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${getVoortgangskleur(
                                    connector.vernietigingsStatus
                                  )}`}
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      Math.min(100, connector.voortgang)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-700">
                            {connector.aantalObjecten}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 text-sm text-slate-500">
                {destructionConnectors.length.toLocaleString("nl-NL")} stekkers geladen
              </div>
            </section>
          </div>
        </div>
      </ContentPanel>
    </>
  );
}
