import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Database,
  FileStack,
  FolderKanban,
  Mail,
  RotateCcw,
} from "lucide-react";

import StatusBadge from "../components/StatusBadge";
import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelSection,
  ActionPanelShortcuts,
} from "../components/ActionPanel";
import ContentPanel, {
  ContentPanelHeader,
  ContentPanelSection,
} from "../components/ContentPanel";
import TaskExecutionContextBar from "../features/task-execution/components/TaskExecutionContextBar";

type Connector = {
  id: string;
  naam: string;
  versie: string;
  stekkerStatus: "SUCCES" | "FOUT";
  vernietigingsStatus:
    | "NIET_GESTART"
    | "BEZIG"
    | "VOLTOOID"
    | "GEDEELTELIJK_VOLTOOID";
  voortgang: number;
  laatsteRun: string;
  aantalObjecten: string;
  melding: string;
  icon: ReactNode;
};

type DestructionActionId = "vernietiging-uitvoeren" | "herkansen";

const connectors: Connector[] = [
  {
    id: "suite4sociaaldomein",
    naam: "Suite4sociaaldomein",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    vernietigingsStatus: "NIET_GESTART",
    voortgang: 0,
    laatsteRun: "Nog niet uitgevoerd",
    aantalObjecten: "-",
    melding: "De vernietiging is nog niet gestart voor deze stekker.",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "djuma",
    naam: "Djuma",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    vernietigingsStatus: "BEZIG",
    voortgang: 42,
    laatsteRun: "31 mei 2026, 09:14",
    aantalObjecten: "1.284 objecten",
    melding: "De vernietiging loopt. De geselecteerde objecten worden momenteel verwerkt.",
    icon: <FileStack className="h-4 w-4" />,
  },
  {
    id: "join",
    naam: "Join",
    versie: "1.0",
    stekkerStatus: "FOUT",
    vernietigingsStatus: "GEDEELTELIJK_VOLTOOID",
    voortgang: 20,
    laatsteRun: "31 mei 2026, 09:08",
    aantalObjecten: "312 objecten",
    melding: "De vernietiging is deels gelukt. Herkansen is nodig voor objecten die nog niet verwerkt zijn.",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "onegov",
    naam: "Onegov",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    vernietigingsStatus: "VOLTOOID",
    voortgang: 100,
    laatsteRun: "31 mei 2026, 09:02",
    aantalObjecten: "842 objecten",
    melding: "De vernietiging is volledig afgerond voor deze stekker.",
    icon: <Mail className="h-4 w-4" />,
  },
];

const taskMetaItems = [
  { label: "Recordmanager", value: "S. Janssen" },
  { label: "Proceseigenaar", value: "Jan de Vries" },
  { label: "Archivaris", value: "M. Blom" },
  { label: "Startdatum", value: "31 mei 2026" },
];

function getVernietigingsStatusLabel(status: Connector["vernietigingsStatus"]) {
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

function getVoortgangskleur(status: Connector["vernietigingsStatus"]) {
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

function getConnectorStageCopy(status: Connector["vernietigingsStatus"]) {
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

export default function RecordDestructionPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const [selectedConnectorId, setSelectedConnectorId] = useState(
    connectors[0]?.id ?? null
  );
  const [selectedAction, setSelectedAction] = useState<DestructionActionId>(
    "vernietiging-uitvoeren"
  );

  const selectedConnector =
    connectors.find((connector) => connector.id === selectedConnectorId) ??
    connectors[0];

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
        handlePrimaryAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAction, selectedConnectorNeedsRetry]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ContentPanel>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex min-w-0 w-full flex-col gap-4">
              <ContentPanelHeader
                eyebrow="Taakuitvoering"
                title="Vernietiging"
                subtitle="Start de vernietiging taakbreed voor alle gekoppelde stekkers. Kies daarna een stekker om de voortgang of een eventuele herkansing te bekijken."
              />

              <TaskExecutionContextBar activeStep="UITVOERING" items={taskMetaItems} />

              <ContentPanelSection
                title="Stekkers"
                description="Kies een stekker om de detailinformatie en eventuele herstelactie te bekijken."
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
                  <div className="space-y-3">
                    {connectors.map((connector) => {
                      const selected = connector.id === selectedConnector.id;

                      return (
                        <button
                          key={connector.id}
                          type="button"
                          onClick={() => setSelectedConnectorId(connector.id)}
                          className={`w-full rounded-md border px-3 py-3 text-left transition-all ${
                            selected
                              ? "border-blue-200 bg-blue-50/60 shadow-sm shadow-blue-100/60"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                                {connector.icon}
                              </div>

                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">
                                  {connector.naam}
                                </div>
                              </div>
                            </div>

                            <StatusBadge
                              status={
                                connector.stekkerStatus === "SUCCES"
                                  ? "GEKOPPELD"
                                  : "FOUT"
                              }
                            />
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                              <span>
                                {getVernietigingsStatusLabel(
                                  connector.vernietigingsStatus
                                )}
                              </span>
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

                  <div className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900">
                          {selectedConnector.naam}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Details van de geselecteerde stekker binnen deze taakuitvoering.
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={
                            selectedConnector.stekkerStatus === "SUCCES"
                              ? "GEKOPPELD"
                              : "FOUT"
                          }
                        />
                        <StatusBadge status={selectedConnector.vernietigingsStatus} />
                      </div>
                    </div>

                    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {getVernietigingsStatusLabel(
                          selectedConnector.vernietigingsStatus
                        )}
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${getVoortgangskleur(
                            selectedConnector.vernietigingsStatus
                          )}`}
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, selectedConnector.voortgang)
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {selectedConnector.voortgang}% voortgang
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        {selectedConnector.melding}
                      </p>
                    </div>

                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="border-b border-slate-100 pb-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Versie
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {selectedConnector.versie}
                        </dd>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Laatste run
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {selectedConnector.laatsteRun}
                        </dd>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Geselecteerde objecten
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {selectedConnector.aantalObjecten}
                        </dd>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Volgende stap
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {selectedConnectorNeedsRetry
                            ? "Herkansen of foutanalyse"
                            : "Wachten op afronding van alle stekkers"}
                        </dd>
                      </div>
                      <div className="border-b border-slate-100 pb-3">
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Statusbeeld
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-900">
                          {getConnectorStageCopy(
                            selectedConnector.vernietigingsStatus
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </ContentPanelSection>
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
