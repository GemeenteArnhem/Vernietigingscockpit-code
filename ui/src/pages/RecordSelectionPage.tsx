import { useMemo, useState, type ReactNode } from "react";
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
} from "../components/ActionPanel";
import ContentPanel, {
  ContentPanelHeader,
  ContentPanelSection,
} from "../components/ContentPanel";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";

type Connector = {
  id: string;
  naam: string;
  versie: string;
  stekkerStatus: "SUCCES" | "FOUT";
  selectieStatus:
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

type SelectionActionId =
  | "selectie-ophalen"
  | "herkansen";

const connectors: Connector[] = [
  {
    id: "suite4sociaaldomein",
    naam: "Suite4sociaaldomein",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "NIET_GESTART",
    voortgang: 0,
    laatsteRun: "Nog niet uitgevoerd",
    aantalObjecten: "-",
    melding: "De selectie is nog niet gestart voor deze stekker.",
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "djuma",
    naam: "Djuma",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "BEZIG",
    voortgang: 42,
    laatsteRun: "31 mei 2026, 09:14",
    aantalObjecten: "1.284 objecten",
    melding: "Snapshot wordt opgebouwd. Resultaten zijn nog niet compleet.",
    icon: <FileStack className="h-4 w-4" />,
  },
  {
    id: "join",
    naam: "Join",
    versie: "1.0",
    stekkerStatus: "FOUT",
    selectieStatus: "GEDEELTELIJK_VOLTOOID",
    voortgang: 20,
    laatsteRun: "31 mei 2026, 09:08",
    aantalObjecten: "312 objecten",
    melding: "De selectie is deels gelukt. Herkansen is nodig voor ontbrekende resultaten.",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "onegov",
    naam: "Onegov",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "VOLTOOID",
    voortgang: 100,
    laatsteRun: "31 mei 2026, 09:02",
    aantalObjecten: "842 objecten",
    melding: "De snapshot is volledig opgehaald en klaar voor beoordeling.",
    icon: <Mail className="h-4 w-4" />,
  },
];

function getSelectieStatusLabel(status: Connector["selectieStatus"]) {
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

function getVoortgangskleur(status: Connector["selectieStatus"]) {
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

function getConnectorStageCopy(status: Connector["selectieStatus"]) {
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

export default function RecordSelectionPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const [selectedConnectorId, setSelectedConnectorId] = useState(
    connectors[0]?.id ?? null
  );
  const [selectedAction, setSelectedAction] = useState<SelectionActionId>(
    "selectie-ophalen"
  );

  const selectedConnector =
    connectors.find((connector) => connector.id === selectedConnectorId) ??
    connectors[0];

  const completedCount = useMemo(
    () =>
      connectors.filter(
        (connector) => connector.selectieStatus === "VOLTOOID"
      ).length,
    []
  );

  const retryableCount = useMemo(
    () =>
      connectors.filter(
        (connector) =>
          connector.selectieStatus === "GEDEELTELIJK_VOLTOOID" ||
          connector.stekkerStatus === "FOUT"
      ).length,
    []
  );

  const allCompleted = completedCount === connectors.length;
  const selectedConnectorNeedsRetry =
    selectedConnector.selectieStatus === "GEDEELTELIJK_VOLTOOID" ||
    selectedConnector.stekkerStatus === "FOUT";

  const handlePrimaryAction = () => {
    if (
      selectedAction === "herkansen" &&
      selectedConnectorNeedsRetry
    ) {
      return;
    }

    navigate(`/taak/${taakId}/taakuitvoering/${id}/beoordeling`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ContentPanel>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex min-w-0 w-full flex-col gap-4">
            <ContentPanelHeader
              eyebrow="Taakuitvoering"
              title="Selectie"
              subtitle="Start de selectie taakbreed voor alle gekoppelde stekkers. Kies daarna een stekker om de voortgang of een eventuele herkansing te bekijken."
            />

            <WorkflowBar activeStep="SELECTIE" />

            <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Recordmanager
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    S. Janssen
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Proceseigenaar
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    Jan de Vries
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Archivaris
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    M. Blom
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Startdatum
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    31 mei 2026
                  </dd>
                </div>
              </dl>
            </section>

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
                            <span>{getSelectieStatusLabel(connector.selectieStatus)}</span>
                            <span>{connector.voortgang}%</span>
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
                      <StatusBadge status={selectedConnector.selectieStatus} />
                    </div>
                  </div>

                  <div className="mt-5 rounded-md border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {getSelectieStatusLabel(selectedConnector.selectieStatus)}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${getVoortgangskleur(
                          selectedConnector.selectieStatus
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
                        {getConnectorStageCopy(selectedConnector.selectieStatus)}
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
            <ActionPanelButtonGroup>
              <ActionPanelButton
                label={
                  selectedAction === "herkansen"
                    ? `Herkansen voor ${selectedConnector.naam}`
                    : "Selectie ophalen"
                }
                variant="primary"
                disabled={
                  selectedAction === "herkansen" &&
                  !selectedConnectorNeedsRetry
                }
                onClick={handlePrimaryAction}
              />
              <ActionPanelButton
                label="Verder naar beoordeling"
                variant="secondary"
                disabled={!allCompleted}
                onClick={() =>
                  navigate(`/taak/${taakId}/taakuitvoering/${id}/beoordeling`)
                }
              />
            </ActionPanelButtonGroup>
          }
        >
          <ActionPanelSection
            title="Kies een actie"
          >
            <div className="space-y-3">
              <ActionPanelChoice
                title="Selectie ophalen"
                description=""
                icon={<ArrowRight size={18} />}
                tone="primary"
                selected={selectedAction === "selectie-ophalen"}
                onClick={() => setSelectedAction("selectie-ophalen")}
              />

              <ActionPanelChoice
                title={`Herkansen voor ${selectedConnector.naam}`}
                description=""
                icon={<RotateCcw size={18} />}
                tone={selectedConnectorNeedsRetry ? "warning" : "neutral"}
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
