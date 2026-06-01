import {
  Archive,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  FolderArchive,
  Layers3,
  ShieldCheck,
} from "lucide-react";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
  ContentPanelSection,
  ContentPanelStat,
  ContentPanelStatGrid,
} from "../ContentPanel";
import StatusBadge from "../StatusBadge";
import TaskProgress from "../TaskProgress";
import type { DashboardTaskRecord } from "../../shared/types/dashboard";

type Props = {
  record?: DashboardTaskRecord;
  currentIndex?: number;
  totalCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
};

function getRiskCopy(record: DashboardTaskRecord) {
  if (record.status === "VERTRAAGD") {
    return {
      label: "Verhoogde aandacht",
      className: "bg-red-50 text-red-700 border border-red-200",
      summary: `Taak staat al ${record.dagenInStap} dagen in dezelfde stap en vraagt opvolging.`,
    };
  }

  if (record.status === "GEPLAND") {
    return {
      label: "Voorbereiding",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
      summary: "Startmoment staat ingepland en de taak wacht op de eerste uitvoeringsstap.",
    };
  }

  return {
    label: "Op schema",
    className: "bg-green-50 text-green-700 border border-green-200",
    summary: "Werkvoorraad loopt volgens planning en heeft geen geregistreerde blokkades.",
  };
}

const timelineItems = [
  {
    title: "Recordmanager",
    subtitle: "Werkvoorraad samengesteld",
    state: "done" as const,
  },
  {
    title: "Proceseigenaar",
    subtitle: "Wacht op beoordeling",
    state: "active" as const,
  },
  {
    title: "Archivaris",
    subtitle: "Nog niet gestart",
    state: "upcoming" as const,
  },
];

function TimelineDot({
  state,
}: {
  state: "done" | "active" | "upcoming";
}) {
  if (state === "done") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-green-100 text-green-600">
        <CheckCircle2 size={15} />
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-blue-100 text-blue-600">
        <Clock3 size={15} />
      </div>
    );
  }

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-slate-100 text-slate-400">
      <CircleDashed size={15} />
    </div>
  );
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

  const risk = getRiskCopy(record);

  return (
    <ContentPanel>
      <ContentPanelBody>
        <ContentPanelHeader
          eyebrow="Taakoverzicht"
          title={record.naam}
          subtitle={record.subtitle}
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
                  {totalCount > 0
                    ? `${currentIndex} van ${totalCount}`
                    : "0 van 0"}
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

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={record.status} />
                <div
                  className={`inline-flex rounded-sm px-2.5 py-1 text-sm font-medium ${risk.className}`}
                >
                  {risk.label}
                </div>
              </div>
            </div>
          }
        />

        <ContentPanelStatGrid>
          <ContentPanelStat
            label="Huidige stap"
            value={record.stap}
            hint={`${record.voortgang}% afgerond`}
            icon={<Archive size={18} />}
          />
          <ContentPanelStat
            label="Recordmanager"
            value={record.recordmanager}
            icon={<ShieldCheck size={18} />}
          />
          <ContentPanelStat
            label="Omvang"
            value={`${record.dossierTelling} dossiers`}
            icon={<Database size={18} />}
          />
          <ContentPanelStat
            label="Frequentie"
            value={record.frequentie}
            icon={<CalendarClock size={18} />}
          />
        </ContentPanelStatGrid>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
          <ContentPanelSection
            title="Voortgang"
            description={risk.summary}
          >
            <TaskProgress
              percentage={record.voortgang}
              stap={record.stap}
              dagen={record.dagenInStap}
              vertraagd={record.status === "VERTRAAGD"}
            />
          </ContentPanelSection>

          <ContentPanelSection
            title="Workflow"
            description="Huidige positie in het proces."
          >
            <div className="space-y-3">
              {timelineItems.map((item, index) => (
                <div
                  key={item.title}
                  className="flex gap-3"
                >
                  <div className="flex flex-col items-center">
                    <TimelineDot state={item.state} />
                    {index < timelineItems.length - 1 && (
                      <div className="mt-1.5 h-7 w-px bg-slate-200" />
                    )}
                  </div>

                  <div className="pb-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </div>
                    <div className="text-sm leading-5 text-slate-500">
                      {item.state === "active" ? record.stap : item.subtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ContentPanelSection>
        </div>
        <ContentPanelSection
          title="Details"
          description="Kerngegevens van deze taakuitvoering."
        >
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Eigenaar
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.eigenaar === "mijn" ? "Mijn werkvoorraad" : "Teamwerkvoorraad"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Planning
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.dagenInStap === 0
                  ? "Nog niet gestart"
                  : `${record.dagenInStap} dagen in stap`}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Status
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {risk.label}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Type
              </dt>
              <dd className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                <Layers3 size={15} className="text-slate-400" />
                Taakuitvoering
              </dd>
            </div>
          </dl>
        </ContentPanelSection>
      </ContentPanelBody>
    </ContentPanel>
  );
}
