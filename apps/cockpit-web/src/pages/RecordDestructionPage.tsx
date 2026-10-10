import { useCallback, useEffect, useMemo, useState } from "react";
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
import ConfirmDialog from "../components/ConfirmDialog";
import ContentPanel from "../components/ContentPanel";
import ShortcutPane from "../components/ShortcutPane";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  getDestructionExecution,
  retryVernietiging,
  startVernietigingsopdracht,
} from "../api/f3Data";
import { useSessionUser } from "../auth/useSessionUser";
import { reviewSummaryStatusStyles } from "../shared/ui/reviewStatusStyles";
import type {
  TaskExecutionConnectorDestructionStatus,
  TaskExecutionDestructionConnector,
} from "../shared/types/taskExecutionConnector";
import ActieFoutmelding from "../components/ActieFoutmelding";

// Vaste lege lijsten, zodat useMemo-afhankelijkheden niet bij elke render veranderen.
const EMPTY_CONNECTORS: DestructionExecutionData["connectors"] = [];

type DestructionExecutionData = Awaited<
  ReturnType<typeof getDestructionExecution>
>;

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
  const { accessToken } = useSessionUser();
  const [selectedConnectorId, setSelectedConnectorId] = useState(
    null as string | null
  );
  const [executionData, setExecutionData] =
    useState<DestructionExecutionData | null>(null);
  const [isLoadingExecution, setIsLoadingExecution] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Standaard 'opnieuw': is opnieuw proberen mogelijk, dan staat die keuze voorgeselecteerd.
  const [selectedAction, setSelectedAction] = useState<"hoofd" | "opnieuw">("opnieuw");

  const connectors = executionData?.connectors ?? EMPTY_CONNECTORS;
  const summaryStats =
    executionData?.summaryStats ?? {
      teBeoordelen: 0,
      akkoord: 0,
      retour: 0,
      uitgesloten: 0,
    };
  const metaItems = executionData?.metaItems ?? [];
  const taakStatus = executionData?.taak.status;
  // Alleen als de API de actie toestaat (CC-13); de UI leidt zelf geen rechten af.
  const canStartDestruction =
    executionData?.taak.toegestaneActies?.includes("vernietiging.opdracht_geven") ?? false;
  const [bevestigOpen, setBevestigOpen] = useState(false);
  const canViewResults = taakStatus === "resultaat" || taakStatus === "archief";
  const isExecutionRunning = taakStatus === "uitvoering";

  const selectedConnector =
    connectors.find((connector) => connector.id === selectedConnectorId) ??
    connectors[0];

  const selectedConnectorIndex = useMemo(
    () =>
      connectors.findIndex(
        (connector) => connector.id === selectedConnector?.id
      ),
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

  const refreshExecution = useCallback(async () => {
    if (!accessToken || !id) {
      return;
    }

    setIsLoadingExecution(true);

    try {
      const data = await getDestructionExecution(accessToken, id);
      setExecutionData(data);
      setSelectedConnectorId((current) =>
        data.connectors.some((connector) => connector.id === current)
          ? current
          : data.connectors[0]?.id ?? null
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Uitvoeringstatus ophalen is mislukt."
      );
    } finally {
      setIsLoadingExecution(false);
    }
  }, [accessToken, id]);

  const kanOpnieuw =
    selectedConnector?.toegestaneActies.includes("vernietiging.opnieuw") ?? false;
  const effectieveActie = kanOpnieuw && selectedAction === "opnieuw" ? "opnieuw" : "hoofd";

  const handleOpnieuw = useCallback(async () => {
    if (!accessToken || !id || !selectedConnector) {
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      await retryVernietiging(accessToken, id, selectedConnector.id);
      await refreshExecution();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Opnieuw starten is mislukt."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, id, refreshExecution, selectedConnector]);

  const handlePrimaryAction = useCallback(async () => {
    if (effectieveActie === "opnieuw") {
      await handleOpnieuw();
      return;
    }

    if (canViewResults) {
      navigate(`/taak/${taakId}/taakuitvoering/${id}/resultaat`);
      return;
    }

    if (!canStartDestruction) {
      return;
    }

    if (!accessToken || !id || !executionData) {
      setActionError("Vernietigingsopdracht kan pas nadat de taak via de API is geladen.");
      return;
    }

    // Eerst bevestigen, met de aantallen per stekker (CC-13).
    setBevestigOpen(true);
  }, [
    accessToken,
    canStartDestruction,
    canViewResults,
    effectieveActie,
    executionData,
    handleOpnieuw,
    id,
    navigate,
    taakId,
  ]);

  const handleBevestigdeOpdracht = useCallback(async () => {
    setBevestigOpen(false);

    if (!accessToken || !id || !executionData) {
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      await startVernietigingsopdracht(accessToken, id, executionData.taak.versie);
      await refreshExecution();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Vernietigingsopdracht starten is mislukt."
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }, [accessToken, executionData, id, refreshExecution]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshExecution();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshExecution]);

  useEffect(() => {
    if (taakStatus !== "uitvoering") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshExecution();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [refreshExecution, taakStatus]);

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

        void handlePrimaryAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrimaryAction]);

  // Zonder uitvoeringsgegevens: een mislukte API-aanroep in het rode foutvlak, anders de lege stand.
  if (!selectedConnector) {
    return (
      <ContentPanel>
        {actionError ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
            Geen uitvoeringsgegevens gevonden voor deze taak.
          </div>
        )}
      </ContentPanel>
    );
  }

  return (
    <>
      <AppShellPortal slot="detail">
        <RecordDetailsPanel
          heading="Stekkerdetails"
          record={{ naam: selectedConnector.naam }}
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
              label: "Vernietigingsstatus",
              value: getVernietigingsStatusLabel(selectedConnector.vernietigingsStatus),
            },
            { label: "Versie", value: selectedConnector.versie },
            { label: "Laatste run", value: selectedConnector.laatsteRun },
            { label: "Te vernietigen objecten", value: selectedConnector.aantalObjecten },
            { label: "Vernietigingsmethode", value: selectedConnector.vernietigingsmethode },
            { label: "Voortgang", value: `${selectedConnector.voortgang}%` },
            {
              label: "Volgende stap",
              value: canViewResults
                ? "Resultaten bekijken"
                : isExecutionRunning
                  ? "Wachten op afronding van alle vernietigingen"
                  : "Vernietigingsopdracht geven",
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
                label={
                  effectieveActie === "opnieuw"
                    ? isSubmitting
                      ? "Opnieuw starten..."
                      : "Opnieuw proberen"
                    : isSubmitting
                    ? "Opdracht geven..."
                    : canViewResults
                      ? "Resultaat bekijken"
                      : isExecutionRunning
                        ? "Uitvoering loopt"
                        : "Vernietigingsopdracht geven"
                }
                variant="primary"
                disabled={
                  isSubmitting ||
                  isLoadingExecution ||
                  (effectieveActie === "hoofd" && !canStartDestruction && !canViewResults)
                }
                onClick={() => {
                  void handlePrimaryAction();
                }}
              />
            </ActionPanelButtonGroup>
          }
        >
          <ActionPanelSection
            title="Kies een actie"
          >
            <div className="space-y-3">
              <ActionPanelChoice
                title={
                  canViewResults
                    ? "Resultaat bekijken"
                    : isExecutionRunning
                      ? "Uitvoering volgen"
                      : "Vernietigingsopdracht geven"
                }
                description={
                  canViewResults
                    ? "De stekkerresultaten zijn beschikbaar."
                    : isExecutionRunning
                      ? "De pagina ververst automatisch zolang de uitvoering loopt."
                      : "Start de technische vernietiging bij de gekoppelde stekkers."
                }
                icon={<ArrowRight size={18} />}
                tone="primary"
                density="compact"
                selected={effectieveActie === "hoofd"}
                onClick={() => setSelectedAction("hoofd")}
              />

              {kanOpnieuw && selectedConnector ? (
                <ActionPanelChoice
                  title={`Opnieuw proberen voor ${selectedConnector.naam}`}
                  description=""
                  icon={<RotateCcw size={18} />}
                  tone="warning"
                  density="compact"
                  selected={effectieveActie === "opnieuw"}
                  onClick={() => setSelectedAction("opnieuw")}
                />
              ) : null}

              <ActieFoutmelding melding={actionError} />
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
            title={executionData?.taak.naam}
            activeStep="UITVOERING"
            summaryStats={summaryStats}
            metaItems={metaItems}
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
                {connectors.length.toLocaleString("nl-NL")} stekkers geladen
                {isLoadingExecution ? " - status verversen..." : ""}
              </div>
            </section>
          </div>
        </div>
      </ContentPanel>

      <ConfirmDialog
        open={bevestigOpen}
        title="Vernietigingsopdracht geven?"
        description="Je start de technische vernietiging bij de gekoppelde stekkers. Dit kan niet worden teruggedraaid."
        confirmLabel="Ja, vernietigingsopdracht geven"
        onCancel={() => setBevestigOpen(false)}
        onConfirm={() => {
          void handleBevestigdeOpdracht();
        }}
      >
        <ul className="mt-4 space-y-2">
          {(executionData?.opdrachtOverzicht ?? []).map((stekker) => (
            <li
              key={stekker.naam}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <span className="font-medium">{stekker.naam}</span>
              <span>
                {stekker.aantalKandidaten.toLocaleString("nl-NL")} kandidaten in{" "}
                {stekker.aantalBatches.toLocaleString("nl-NL")}{" "}
                {stekker.aantalBatches === 1 ? "batch" : "batches"}
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  );
}
