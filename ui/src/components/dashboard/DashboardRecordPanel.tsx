import {
  ChevronLeft,
  ChevronRight,
  FolderArchive,
} from "lucide-react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
} from "../ContentPanel";
import TaskMetaBar from "../TaskMetaBar";
import RecordCommentsSection from "../../features/task-execution/components/RecordCommentsSection";
import RecordDetailsSection from "../../features/task-execution/components/RecordDetailsSection";
import WorkflowBar from "../../features/task-execution/components/WorkflowBar";
import { dashboardTaskExecutionPanelById } from "../../shared/mocks/dashboardTaskExecutionPanel";
import type { DashboardTaskRecord } from "../../shared/types/dashboard";

type Props = {
  record?: DashboardTaskRecord;
  currentIndex?: number;
  totalCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

function getWorkflowStep(record: DashboardTaskRecord) {
  const step = record.stap.toLowerCase();

  if (step.includes("selectie")) {
    return "SELECTIE";
  }

  if (step.includes("beoordeling") || step.includes("controle")) {
    return "BEOORDELING";
  }

  if (step.includes("proceseigenaar") || step.includes("po")) {
    return "ACCORDERING_PO";
  }

  if (step.includes("archivaris")) {
    return "ACCORDERING_ARCH";
  }

  if (step.includes("uitvoering")) {
    return "UITVOERING";
  }

  if (step.includes("resultaat")) {
    return "RESULTAAT";
  }

  return "BEOORDELING";
}

export default function DashboardRecordPanel({
  record,
  currentIndex = 0,
  totalCount = 0,
  onPrevious,
  onNext,
}: Props) {
  if (!record) {
    return (
      <ContentPanel>
        <ContentPanelEmptyState
          icon={<FolderArchive size={24} />}
          title="Kies een taak uit de werkvoorraad"
          description="Na selectie tonen we hier de kerninformatie, voortgang en context van de gekozen uitvoering."
        />
      </ContentPanel>
    );
  }

  const taskMetaItems = [
    { label: "Recordmanager", value: record.recordmanager },
    { label: "Proceseigenaar", value: "Jan de Vries" },
    { label: "Archivaris", value: "M. Blom" },
    {
      label: "Startdatum",
      value: record.subtitle.replace(/^Gestart\s+/i, "").replace(/^Start gepland op\s+/i, ""),
    },
  ];
  const panelData = dashboardTaskExecutionPanelById[record.id];

  return (
    <ContentPanel>
      <ContentPanelBody>
        <ContentPanelHeader
          eyebrow="Taakuitvoering"
          title={record.naam}
          aside={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!onPrevious}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Vorige taak"
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
                  aria-label="Volgende taak"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          }
        />

        <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-3">
            <WorkflowBar activeStep={getWorkflowStep(record)} variant="embedded" />

            <div className="border-t border-slate-100 pt-3">
              <TaskMetaBar items={taskMetaItems} variant="embedded" />
            </div>
          </div>
        </section>

        {panelData && (
          <>
            <RecordDetailsSection
              record={panelData.record}
              vernietigbaarSinds={panelData.vernietigbaarSinds}
            />

            <RecordCommentsSection
              comments={panelData.comments}
              description="Laatste notities binnen deze taakuitvoering."
            />
          </>
        )}
      </ContentPanelBody>
    </ContentPanel>
  );
}
