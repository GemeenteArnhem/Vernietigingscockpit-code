import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, RotateCcw } from "lucide-react";

import StatusBadge from "../components/StatusBadge";
import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelSection,
  ActionPanelShortcuts,
} from "../components/ActionPanel";
import ContentPanel from "../components/ContentPanel";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import {
  destructionConnectors,
  destructionSummaryStats,
  destructionTaskMetaItems,
} from "../shared/mocks/recordDestructionPage";
import type {
  TaskExecutionConnectorDestructionStatus,
  TaskExecutionDestructionConnector,
} from "../shared/types/taskExecutionConnector";

type DestructionActionId = "vernietiging-uitvoeren" | "herkansen";

function getVernietigingsStatusLabel(
  status: TaskExecutionConnectorDestructionStatus
) {
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
      return "bg-green-500";
    case "GEDEELTELIJK_VOLTOOID":
      return "bg-amber-500";
    case "BEZIG":
      return "bg-blue-500";
    case "NIET_GESTART":
      return "bg-slate-300";
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

function getConnectorStatusBadgeClasses(
  connector: TaskExecutionDestructionConnector
) {
  if (connector.stekkerStatus === "FOUT") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
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
    destructionConnectors.find(
      (connector) => connector.id === selectedConnectorId
    ) ?? destructionConnectors[0];

  const selectedConnectorIndex = useMemo(
    () =>
      destructionConnectors.findIndex(
        (connector) => connector.id === selectedConnector.id
      ),
    [selectedConnector]
  );

  const previousConnector =
    selectedConnectorIndex > 0
      ? destructionConnectors[selectedConnectorIndex - 1]
      : undefined;
  const nextConnector =
    selectedConnectorIndex >= 0 &&
    selectedConnectorIndex < destructionConnectors.length - 1
      ? destructionConnectors[selectedConnectorIndex + 1]
      : undefined;

  const selectedConnectorNeedsRetry =
    selectedConnector.vernietigingsStatus === "GEDEELTELIJK_VOLTOOID" ||
    selectedConnector.stekkerStatus === "FOUT";

  const handlePrimaryAction = () => {
    if (selectedAction === "herkansen" && selectedConnectorNeedsRetry) {
      return;
    }

    navigate(`/taak/${taakId}/taakuitvoering/${id}/resultaat`);
  };

  const handleSecondaryAction = () => {
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

        if (selectedAction === "herkansen" && selectedConnectorNeedsRetry) {
          return;
        }

        navigate(`/taak/${taakId}/taakuitvoering/${id}/resultaat`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, navigate, selectedAction, selectedConnectorNeedsRetry, taakId]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="w-[340px] shrink-0 border-r border-slate-200 bg-white">
        <RecordDetailsPanel
          heading="Stekkerdetails"
          record={{ titel: selectedConnector.naam }}
          comments={[]}
          currentIndex={selectedConnectorIndex >= 0 ? selectedConnectorIndex + 1 : 0}
          totalCount={destructionConnectors.length}
          onPrevious={
            previousConnector
              ? () => setSelectedConnectorId(previousConnector.id)
              : undefined
          }
          onNext={
            nextConnector ? () => setSelectedConnectorId(nextConnector.id) : undefined
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
            { label: "Geselecteerde objecten", value: selectedConnector.aantalObjecten },
            { label: "Voortgang", value: `${selectedConnector.voortgang}%` },
            {
              label: "Volgende stap",
              value: selectedConnectorNeedsRetry
                ? "Herkansen of foutanalyse"
                : "Wachten op afronding van alle stekkers",
            },
            {
              label: "Statusbeeld",
              value: getConnectorStageCopy(selectedConnector.vernietigingsStatus),
            },
            { label: "Melding", value: selectedConnector.melding },
          ]}
        />
      </aside>

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <ContentPanel>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <TaskExecutionHeader
              activeStep="UITVOERING"
              summaryStats={destructionSummaryStats}
              metaItems={destructionTaskMetaItems}
            />

            <div className="flex min-w-0 w-full flex-col p-4">
              <section className="-m-4 bg-white px-4 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Stekkers</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Kies een stekker om links de detailinformatie en rechts de passende actie te bekijken.
                  </p>
                </div>

                <div className="mt-3">
                  <div className="space-y-3">
                    {destructionConnectors.map((connector) => {
                      const selected = connector.id === selectedConnector.id;

                      return (
                        <button
                          key={connector.id}
                          type="button"
                          onClick={() => setSelectedConnectorId(connector.id)}
                          className={`w-full rounded-md border px-4 py-3 text-left transition-all ${
                            selected
                              ? "border-blue-200 bg-blue-50/60 shadow-sm shadow-blue-100/60"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                {connector.icon}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">
                                  {connector.naam}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {getConnectorStageCopy(connector.vernietigingsStatus)}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge
                                status={
                                  connector.stekkerStatus === "SUCCES"
                                    ? "GEKOPPELD"
                                    : "FOUT"
                                }
                              />
                              <StatusBadge status={connector.vernietigingsStatus} />
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                              <span>{connector.aantalObjecten}</span>
                              <span>{connector.voortgang}%</span>
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
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </ContentPanel>

        <ActionPanel
          title="Acties"
          footer={
            <div className="space-y-2.5">
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Actie uitvoeren"
                  variant="primary"
                  disabled={
                    selectedAction === "herkansen" && !selectedConnectorNeedsRetry
                  }
                  onClick={handlePrimaryAction}
                />
                <ActionPanelButton
                  label="Verder naar resultaat"
                  variant="secondary"
                  onClick={handleSecondaryAction}
                />
              </ActionPanelButtonGroup>

              <ActionPanelShortcuts
                shortcuts={[{ keyLabel: "W", label: "Actie uitvoeren" }]}
              />
            </div>
          }
        >
          <ActionPanelSection title="Kies een actie">
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
      </div>
    </div>
  );
}
