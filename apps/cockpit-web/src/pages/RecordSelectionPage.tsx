import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Plug,
  RotateCcw,
} from "lucide-react";

import StatusBadge from "../components/StatusBadge";
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
  getTaskSelection,
  startTaskSelection,
} from "../api/f3Data";
import { useSessionUser } from "../auth/useSessionUser";
import { reviewSummaryStatusStyles } from "../shared/ui/reviewStatusStyles";
import type {
  TaskExecutionConnector,
  TaskExecutionConnectorSelectionStatus,
} from "../shared/types/taskExecutionConnector";

type SelectionActionId =
  | "selectie-ophalen"
  | "herkansen"
  | "naar-beoordeling";

const EMPTY_CONNECTORS: TaskExecutionConnector[] = [];

function getSelectieStatusLabel(status: TaskExecutionConnectorSelectionStatus) {
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

function getVoortgangskleur(status: TaskExecutionConnectorSelectionStatus) {
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

function getConnectorStageCopy(status: TaskExecutionConnectorSelectionStatus) {
  switch (status) {
    case "VOLTOOID":
      return "Snapshot volledig";
    case "GEDEELTELIJK_VOLTOOID":
      return "Herstel nodig";
    case "BEZIG":
      return "Snapshot loopt";
    case "NIET_GESTART":
      return "Wacht op start";
  }
}

function getConnectorStatusBadgeClasses(connector: TaskExecutionConnector) {
  if (connector.stekkerStatus === "FOUT") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export default function RecordSelectionPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const { accessToken } = useSessionUser();
  const [apiConnectors, setApiConnectors] = useState<TaskExecutionConnector[] | null>(
    null
  );
  const [apiSummaryStats, setApiSummaryStats] = useState({
    teBeoordelen: 0,
    akkoord: 0,
    retour: 0,
    uitgesloten: 0,
  });
  const [apiTaskName, setApiTaskName] = useState<string | null>(null);
  const [isStartingSelection, setIsStartingSelection] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [continuePromptDismissed, setContinuePromptDismissed] = useState(false);
  const [continueCountdown, setContinueCountdown] = useState(5);
  const [selectedConnectorId, setSelectedConnectorId] = useState(
    null as string | null
  );
  const [selectedAction, setSelectedAction] = useState<SelectionActionId>(
    "selectie-ophalen"
  );

  const connectors = apiConnectors ?? EMPTY_CONNECTORS;
  const summaryStats = apiSummaryStats;

  const selectedConnector =
    connectors.find((connector) => connector.id === selectedConnectorId) ??
    connectors[0];

  const selectedConnectorIndex = useMemo(
    () => connectors.findIndex((connector) => connector.id === selectedConnector?.id),
    [connectors, selectedConnector]
  );

  const previousConnector =
    selectedConnectorIndex > 0
      ? connectors[selectedConnectorIndex - 1]
      : undefined;
  const nextConnector =
    selectedConnectorIndex >= 0 && selectedConnectorIndex < connectors.length - 1
      ? connectors[selectedConnectorIndex + 1]
      : undefined;

  const selectedConnectorNeedsRetry =
    selectedConnector?.selectieStatus === "GEDEELTELIJK_VOLTOOID" ||
    selectedConnector?.stekkerStatus === "FOUT";
  const hasApiData = apiConnectors !== null;
  const allConnectorsComplete =
    connectors.length > 0 &&
    connectors.every(
      (connector) =>
        connector.selectieStatus === "VOLTOOID" &&
        connector.stekkerStatus === "SUCCES"
    );
  const hasRunningSelection = connectors.some(
    (connector) => connector.selectieStatus === "BEZIG"
  );
  const hasUnstartedSelection = connectors.some(
    (connector) => connector.selectieStatus === "NIET_GESTART"
  );
  const continuePromptOpen =
    hasApiData &&
    allConnectorsComplete &&
    !continuePromptDismissed;
  const effectiveSelectedAction: SelectionActionId = allConnectorsComplete
    ? "naar-beoordeling"
    : selectedConnectorNeedsRetry
      ? "herkansen"
      : hasUnstartedSelection
        ? "selectie-ophalen"
        : selectedAction;

  const navigateToReview = useCallback(() => {
    navigate(`/taak/${taakId}/taakuitvoering/${id}/beoordeling`);
  }, [id, navigate, taakId]);

  const refreshSelection = useCallback(async () => {
    if (!accessToken || !id) {
      return;
    }

    const selection = await getTaskSelection(accessToken, id);

    setApiConnectors(selection.connectors);
    setApiSummaryStats(selection.summaryStats);
    setApiTaskName(selection.taak.naam);
    setSelectedConnectorId((current) => current ?? selection.connectors[0]?.id ?? null);
    setApiError(null);
  }, [accessToken, id]);

  useEffect(() => {
    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      if (!isCurrent) {
        return;
      }

      void refreshSelection().catch((caught) => {
          if (isCurrent) {
            setApiError(
              caught instanceof Error
                ? caught.message
                : "Selectiegegevens laden is mislukt."
            );
          }
        });
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [refreshSelection]);

  useEffect(() => {
    if (!hasApiData || allConnectorsComplete || !accessToken || !id) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSelection().catch((caught) => {
        setApiError(
          caught instanceof Error
            ? caught.message
            : "Selectiegegevens verversen is mislukt."
        );
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [accessToken, allConnectorsComplete, hasApiData, id, refreshSelection]);

  useEffect(() => {
    if (!continuePromptOpen) {
      return;
    }

    if (continueCountdown <= 0) {
      navigateToReview();
      return;
    }

    const timeout = window.setTimeout(() => {
      setContinueCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [continueCountdown, continuePromptOpen, navigateToReview]);

  const handlePrimaryAction = useCallback(async () => {
    if (effectiveSelectedAction === "naar-beoordeling") {
      navigateToReview();
      return;
    }

    if (
      effectiveSelectedAction === "herkansen" &&
      !selectedConnectorNeedsRetry
    ) {
      return;
    }

    if (
      (effectiveSelectedAction === "selectie-ophalen" ||
        effectiveSelectedAction === "herkansen") &&
      accessToken &&
      id
    ) {
      setIsStartingSelection(true);
      setApiError(null);

      try {
        const retryStekkerId =
          effectiveSelectedAction === "herkansen"
            ? selectedConnector?.id
            : undefined;
        const selection = await startTaskSelection(accessToken, id, {
          stekkerId: retryStekkerId,
        });

        setApiConnectors(selection.connectors);
        setApiSummaryStats(selection.summaryStats);
        setApiTaskName(selection.taak.naam);
        setSelectedConnectorId(retryStekkerId ?? selection.connectors[0]?.id ?? null);
        setContinuePromptDismissed(false);
        setContinueCountdown(5);
      } catch (caught) {
        setApiError(caught instanceof Error ? caught.message : "Selectie starten is mislukt.");
      } finally {
        setIsStartingSelection(false);
      }

      return;
    }

    navigateToReview();
  }, [
    accessToken,
    effectiveSelectedAction,
    id,
    navigateToReview,
    selectedConnector,
    selectedConnectorNeedsRetry,
  ]);

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

        if (
          effectiveSelectedAction === "herkansen" &&
          !selectedConnectorNeedsRetry
        ) {
          return;
        }

        void handlePrimaryAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveSelectedAction, handlePrimaryAction, selectedConnectorNeedsRetry]);

  if (!selectedConnector) {
    return (
      <ContentPanel>
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
          Geen stekkers gekoppeld aan deze taakuitvoering.
        </div>
      </ContentPanel>
    );
  }

  return (
    <>
      <AppShellPortal slot="detail">
        <RecordDetailsPanel
          heading="Stekkerdetails"
          record={{ titel: selectedConnector.naam }}
          comments={[]}
          showTabs={false}
          currentIndex={selectedConnectorIndex >= 0 ? selectedConnectorIndex + 1 : 0}
          totalCount={connectors.length}
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
              label: "Selectiestatus",
              value: getSelectieStatusLabel(selectedConnector.selectieStatus),
            },
            { label: "Versie", value: selectedConnector.versie },
            { label: "Laatste run", value: selectedConnector.laatsteRun },
            { label: "Geselecteerde objecten", value: selectedConnector.aantalObjecten },
            { label: "Voortgang", value: `${selectedConnector.voortgang}%` },
            {
              label: "Volgende stap",
              value: allConnectorsComplete
                ? "Naar beoordeling"
                : selectedConnectorNeedsRetry
                  ? "Herkansen of foutanalyse"
                  : "Wachten op afronding van alle stekkers",
            },
            {
              label: "Statusbeeld",
              value: getConnectorStageCopy(selectedConnector.selectieStatus),
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
                label={
                  allConnectorsComplete
                    ? "Naar beoordeling"
                    : hasRunningSelection
                      ? "Selectie loopt"
                      : "Actie uitvoeren"
                }
                variant="primary"
                disabled={
                  isStartingSelection ||
                  hasRunningSelection ||
                  (effectiveSelectedAction === "herkansen" &&
                    !selectedConnectorNeedsRetry)
                }
                onClick={handlePrimaryAction}
              />
            </ActionPanelButtonGroup>
          }
        >
          <ActionPanelSection
            title={
              allConnectorsComplete
                ? "Selectie afgerond"
                : hasRunningSelection
                  ? "Selectie wordt verwerkt"
                  : "Kies een actie"
            }
          >
            <div className="space-y-3">
              {allConnectorsComplete ? (
                <ActionPanelChoice
                  title="Naar beoordeling"
                  description="De snapshot is volledig opgehaald en geimporteerd."
                  icon={<CheckCircle2 size={18} />}
                  tone="success"
                  density="compact"
                  selected={effectiveSelectedAction === "naar-beoordeling"}
                  onClick={() => setSelectedAction("naar-beoordeling")}
                />
              ) : hasRunningSelection ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-5 text-sky-900">
                  De selectie loopt. De cockpit ververst deze status automatisch.
                </div>
              ) : (
                <>
                  {hasUnstartedSelection ? (
                    <ActionPanelChoice
                      title="Selectie ophalen"
                      description=""
                      icon={<ArrowRight size={18} />}
                      tone="primary"
                      density="compact"
                      selected={effectiveSelectedAction === "selectie-ophalen"}
                      onClick={() => setSelectedAction("selectie-ophalen")}
                    />
                  ) : null}

                  {selectedConnectorNeedsRetry ? (
                    <ActionPanelChoice
                      title={`Herkansen voor ${selectedConnector.naam}`}
                      description=""
                      icon={<RotateCcw size={18} />}
                      tone="warning"
                      density="compact"
                      selected={effectiveSelectedAction === "herkansen"}
                      onClick={() => setSelectedAction("herkansen")}
                    />
                  ) : null}
                </>
              )}
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
            title={apiTaskName ?? undefined}
            activeStep="SELECTIE"
            summaryStats={summaryStats}
            metaItems={[]}
            showStatusOverview={false}
          />

          <div className="flex min-w-0 w-full flex-1 flex-col">
            {apiError ? (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {apiError}
              </div>
            ) : null}
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
                      <th className="w-[18%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Stekkerstatus
                      </th>
                      <th className="w-[34%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Voortgang
                      </th>
                      <th className="w-[18%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Objecten
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {connectors.map((connector) => {
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
                          className={`cursor-pointer border-b border-slate-100 transition focus:outline-none focus:ring-2 focus:ring-sky-400/35 focus:ring-inset hover:bg-slate-50 ${
                            selected ? "bg-sky-50/60" : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                {connector.icon ?? <Plug className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-900">
                                  {connector.naam}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <StatusBadge
                              status={
                                connector.stekkerStatus === "SUCCES"
                                  ? "GEKOPPELD"
                                  : "FOUT"
                              }
                            />
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                                <span className="truncate">
                                  {getConnectorStageCopy(connector.selectieStatus)}
                                </span>
                                <span className="shrink-0">
                                  {connector.voortgang}%
                                </span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${getVoortgangskleur(
                                    connector.selectieStatus
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
                {connectors.length.toLocaleString("nl-NL")} stekkers geladen
              </div>
            </section>
          </div>
        </div>
      </ContentPanel>

      {continuePromptOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selection-complete-title"
        >
          <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" />
          <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2
                    id="selection-complete-title"
                    className="text-base font-semibold text-slate-950"
                  >
                    Selectie is klaar voor beoordeling
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Alle stekkers zijn succesvol verwerkt. Je gaat automatisch door over {continueCountdown} seconden.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setContinuePromptDismissed(true);
                }}
                className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Hier blijven
              </button>
              <button
                type="button"
                onClick={navigateToReview}
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Nu naar beoordeling
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
