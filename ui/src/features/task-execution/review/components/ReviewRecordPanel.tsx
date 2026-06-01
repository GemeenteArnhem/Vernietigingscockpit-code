import {
  ChevronLeft,
  ChevronRight,
  FolderArchive,
  UserRoundCheck,
} from "lucide-react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
  ContentPanelSection,
} from "../../../../components/ContentPanel";
import StatusBadge from "../../../../components/StatusBadge";
import WorkflowBar from "../../components/WorkflowBar";
import type { VernietigingsObject } from "../../../../shared/types/destruction";
import type {
  ReviewComment,
  ReviewQueueStatus,
  ReviewRecordContext,
} from "../../../../shared/types/review";

type Props = {
  record?: VernietigingsObject;
  context?: ReviewRecordContext;
  queueStatus?: ReviewQueueStatus;
  currentIndex?: number;
  totalCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

function formatRiskLabel(risk?: ReviewRecordContext["risiconiveau"]) {
  if (risk === "hoog") {
    return {
      label: "Hoog risico",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (risk === "middel") {
    return {
      label: "Middel risico",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Laag risico",
    className: "border-green-200 bg-green-50 text-green-700",
  };
}

function formatQueueStatus(status?: ReviewRecordContext["queueStatus"]) {
  switch (status) {
    case "afgerond":
      return "VOLTOOID";
    case "conflict":
      return "FOUT";
    case "retour":
      return "WAARSCHUWING";
    default:
      return "IN_BEHANDELING";
  }
}

function CommentCard({
  comment,
}: {
  comment: ReviewComment;
}) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50/80 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{comment.author}</div>
          <div className="text-xs text-slate-500">{comment.role}</div>
        </div>
        <div className="text-xs text-slate-400">{comment.timestamp}</div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{comment.message}</p>
    </div>
  );
}

export default function ReviewRecordPanel({
  record,
  context,
  queueStatus,
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
          title="Kies een record uit de lijst"
          description="Na selectie tonen we hier de taakcontext en recorddetails."
        />
      </ContentPanel>
    );
  }

  const risk = formatRiskLabel(context.risiconiveau);

  return (
    <ContentPanel>
      <ContentPanelBody>
        <ContentPanelHeader
          eyebrow="Taakuitvoering"
          title={record.titel}
          subtitle={`${context.proces} / Bronrecord ${record.bron_id ?? record.id}`}
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

        <WorkflowBar activeStep="BEOORDELING" />

        <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={formatQueueStatus(queueStatus ?? context.queueStatus)}
              size="md"
            />
            <div
              className={`inline-flex rounded-md border px-2.5 py-1 text-sm font-medium ${risk.className}`}
            >
              {risk.label}
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Proces
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{context.proces}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Recordmanager
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {context.recordmanager}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Proceseigenaar
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {context.proceseigenaar}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Archivaris
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{context.archivaris}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Startdatum taak
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {context.startdatumTaak}
              </dd>
            </div>
          </dl>
        </section>

        <ContentPanelSection
          title="Recorddetails"
          description="Metadata en herkomst van het geselecteerde record."
        >
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Bron-ID
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.bron_id ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Selectielijst
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.selectielijst ?? "-"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Grondslag
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.grondslag ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Code
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.code ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Omvang
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.omvang} dossier{record.omvang === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Bewaartermijn
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.bewaartermijn} jaar
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Vernietigbaar sinds
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {context.vernietigbaarSinds}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Bronsysteem
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.bron_systeem ?? "-"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Startdatum record
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.startdatum ?? "-"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Einddatum record
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.einddatum ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Uitsluitreden
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.reden ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Type
              </dt>
              <dd className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                <UserRoundCheck size={15} className="text-slate-400" />
                Vernietigbaar record
              </dd>
            </div>
          </dl>
        </ContentPanelSection>

        <ContentPanelSection
          title="Opmerkingen"
          description="Laatste notities bij dit record."
        >
          <div className="space-y-3">
            {context.comments.map((comment) => (
              <CommentCard
                key={`${comment.author}-${comment.timestamp}`}
                comment={comment}
              />
            ))}
          </div>
        </ContentPanelSection>
      </ContentPanelBody>
    </ContentPanel>
  );
}
