import {
  ChevronLeft,
  ChevronRight,
  FolderArchive,
} from "lucide-react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
} from "../../../../components/ContentPanel";
import RecordCommentsSection from "../../components/RecordCommentsSection";
import RecordDetailsSection from "../../components/RecordDetailsSection";
import TaskMetaBar from "../../../../components/TaskMetaBar";
import WorkflowBar from "../../components/WorkflowBar";
import type { VernietigingsObject } from "../../../../shared/types/destruction";
import type {
  ReviewQueueStatus,
  ReviewRecordContext,
} from "../../../../shared/types/review";

type Props = {
  record?: VernietigingsObject;
  context?: ReviewRecordContext;
  queueStatus?: ReviewQueueStatus;
  currentIndex?: number;
  totalCount?: number;
  activeStep?: string;
  onPrevious?: () => void;
  onNext?: () => void;
};

export default function ReviewRecordPanel({
  record,
  context,
  currentIndex = 0,
  totalCount = 0,
  activeStep = "BEOORDELING",
  onPrevious,
  onNext,
}: Props) {
  if (!record || !context) {
    return (
      <ContentPanel>
        <ContentPanelEmptyState
          icon={<FolderArchive size={24} />}
          title="Kies een record uit de lijst"
          description="Na selectie tonen we hier de taakcontext en recorddetails."
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
          aside={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!onPrevious}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Vorig record"
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
                  aria-label="Volgend record"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          }
        />

        <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-3">
            <WorkflowBar activeStep={activeStep} variant="embedded" />

            <div className="border-t border-slate-100 pt-3">
              <TaskMetaBar items={taskMetaItems} variant="embedded" />
            </div>
          </div>
        </section>

        <RecordDetailsSection
          record={record}
          vernietigbaarSinds={context.vernietigbaarSinds}
        />

        <RecordCommentsSection
          comments={context.comments}
        />
      </ContentPanelBody>
    </ContentPanel>
  );
}
