import {
  ChevronLeft,
  ChevronRight,
  FolderArchive,
  TimerReset,
  Waypoints,
} from "lucide-react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
  ContentPanelSection,
  ContentPanelStat,
} from "../../../../components/ContentPanel";
import StatusBadge from "../../../../components/StatusBadge";
import TaskExecutionContextBar from "../../components/TaskExecutionContextBar";
import type {
  DestructionResultContext,
  DestructionResultRow,
} from "../../../../shared/types/destructionResult";

type Props = {
  record?: DestructionResultRow;
  context?: DestructionResultContext;
  currentIndex?: number;
  totalCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

function formatPlannedDestructionDate(value?: string) {
  if (!value) {
    return "-";
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const [, year, month] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function DestructionResultRecordPanel({
  record,
  context,
  currentIndex = 0,
  totalCount = 0,
  onPrevious,
  onNext,
}: Props) {
  if (!record || !context) {
    return (
      <ContentPanel>
        <ContentPanelEmptyState
          icon={<FolderArchive size={24} />}
          title="Kies een resultaat uit de lijst"
          description="Na selectie tonen we hier de taakcontext, uitvoerstatus en details van het record."
        />
      </ContentPanel>
    );
  }

  const taskMetaItems = [
    { label: "Recordmanager", value: context.recordmanager },
    { label: "Proceseigenaar", value: context.proceseigenaar },
    { label: "Archivaris", value: context.archivaris },
    { label: "Startdatum", value: context.startdatumTaak },
  ];

  return (
    <ContentPanel>
      <ContentPanelBody>
        <ContentPanelHeader
          eyebrow="Taakuitvoering"
          title={record.titel}
          subtitle="Inzicht in de uitvoerstatus en vervolgactie voor dit record."
          aside={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!onPrevious}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Vorig resultaat"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="min-w-16 text-center text-xs font-semibold text-slate-500">
                  {totalCount > 0 ? `${currentIndex} van ${totalCount}` : "0 van 0"}
                </span>

                <button
                  type="button"
                  onClick={onNext}
                  disabled={!onNext}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Volgend resultaat"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          }
        />

        <TaskExecutionContextBar activeStep="RESULTAAT" items={taskMetaItems} />

        <ContentPanelSection
          title="Uitkomst"
          description="Samenvatting van de verwerkte actie voor dit record."
        >
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  Status van vernietiging
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="shrink-0">
                    <StatusBadge status={record.vernietigingsstatus} size="md" />
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-slate-600">
                    {context.statusDetail}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <ContentPanelStat
                label="Stekker"
                value={record.stekker}
                icon={<Waypoints size={16} />}
                hint="Gebruikte connector in deze uitvoer."
              />
              <ContentPanelStat
                label="Vernietigingsdatum"
                value={formatPlannedDestructionDate(record.vernietigingsdatum)}
                icon={<TimerReset size={16} />}
                hint="Gepland vernietigingsmoment volgens de vernietigingslijst."
              />
              <ContentPanelStat
                label="Documenten"
                value={`${record.omvang ?? 0} ${record.omvang === 1 ? "document" : "documenten"}`}
                icon={<FolderArchive size={16} />}
                hint="Aantal documenten in deze uitvoerregel."
              />
            </div>
          </div>
        </ContentPanelSection>
      </ContentPanelBody>
    </ContentPanel>
  );
}
