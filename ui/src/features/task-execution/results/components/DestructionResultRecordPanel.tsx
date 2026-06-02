import { ChevronLeft, ChevronRight, FolderArchive, ShieldCheck, TimerReset, Waypoints } from "lucide-react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
  ContentPanelSection,
  ContentPanelStat,
  ContentPanelStatGrid,
} from "../../../../components/ContentPanel";
import StatusBadge from "../../../../components/StatusBadge";
import TaskMetaBar from "../../../../components/TaskMetaBar";
import WorkflowBar from "../../components/WorkflowBar";
import RecordCommentsSection from "../../components/RecordCommentsSection";
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
          subtitle="Inzicht in de uitvoerstatus, technische melding en vervolgactie voor dit record."
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

        <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-3">
            <WorkflowBar activeStep="RESULTAAT" variant="embedded" />

            <div className="border-t border-slate-100 pt-3">
              <TaskMetaBar items={taskMetaItems} variant="embedded" />
            </div>
          </div>
        </section>

        <ContentPanelSection
          title="Uitkomst"
          description="Samenvatting van de verwerkte actie voor dit record."
        >
          <ContentPanelStatGrid>
            <ContentPanelStat
              label="Status"
              value={record.vernietigingsstatus}
              icon={<ShieldCheck size={16} />}
              hint={context.statusDetail}
            />
            <ContentPanelStat
              label="Stekker"
              value={record.stekker}
              icon={<Waypoints size={16} />}
              hint={context.bronSysteem}
            />
            <ContentPanelStat
              label="Vernietigingsdatum"
              value={record.vernietigingsdatum ?? "-"}
              icon={<TimerReset size={16} />}
              hint="Geplande datum uit de vernietigingslijst."
            />
            <ContentPanelStat
              label="Omvang"
              value={context.omvangLabel}
              icon={<FolderArchive size={16} />}
              hint="Aantal objecten in deze uitvoerregel."
            />
          </ContentPanelStatGrid>

          <div className="mt-4 rounded-sm border border-slate-200 bg-slate-50/70 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Vernietigingsstatus
                </div>
                <div className="mt-2">
                  <StatusBadge status={record.vernietigingsstatus} size="md" />
                </div>
              </div>

              <div className="max-w-xl text-sm leading-6 text-slate-600">
                {context.statusDetail}
              </div>
            </div>
          </div>
        </ContentPanelSection>

        <ContentPanelSection
          title="Metadata"
          description="Belangrijkste bron- en classificatiegegevens uit het resultaat."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-sm border border-slate-200 bg-slate-50/50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Broninformatie</h3>
              <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                <DetailItem label="Bron-ID" value={record.bron_id ?? "-"} />
                <DetailItem label="Bronsysteem" value={record.bron_systeem ?? "-"} />
                <DetailItem label="Stekker" value={record.stekker} />
                <DetailItem label="Code" value={record.code ?? "-"} />
              </dl>
            </div>

            <div className="rounded-sm border border-slate-200 bg-slate-50/50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Classificatie</h3>
              <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                <DetailItem label="Grondslag" value={record.grondslag ?? "-"} />
                <DetailItem label="Omvang" value={context.omvangLabel} />
                <DetailItem label="Vervolgstap" value={context.vervolgstap} />
                <DetailItem label="Statuslabel" value={record.vernietigingsstatus} />
              </dl>
            </div>
          </div>
        </ContentPanelSection>

        <RecordCommentsSection
          comments={context.comments}
          title="Technische melding"
          description="Laatste systeemmelding en vastgelegde uitvoercontext voor dit record."
        />
      </ContentPanelBody>
    </ContentPanel>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
