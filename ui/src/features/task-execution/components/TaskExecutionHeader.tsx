import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronUp,
  ClipboardCheck,
  User,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { reviewRows } from "../../../shared/mocks/reviewRows";
import { reviewSummaryStatusStyles } from "../../../shared/ui/reviewStatusStyles";

type TaskExecutionHeaderMetaItem = {
  label: string;
  value: string;
  icon?: ReactNode;
};

type TaskExecutionHeaderSummaryStats = {
  teBeoordelen: number;
  akkoord: number;
  retour: number;
  uitgesloten: number;
};

type Props = {
  title?: string;
  activeStep?: string;
  summaryStats: TaskExecutionHeaderSummaryStats;
  metaItems: TaskExecutionHeaderMetaItem[];
  showStatusOverview?: boolean;
};

export type {
  TaskExecutionHeaderMetaItem,
  TaskExecutionHeaderSummaryStats,
};

const STAT_ITEMS = [
  { key: "teBeoordelen", label: "Te beoordelen", style: reviewSummaryStatusStyles.teBeoordelen },
  { key: "akkoord", label: "Akkoord", style: reviewSummaryStatusStyles.akkoord },
  { key: "retour", label: "Retour", style: reviewSummaryStatusStyles.retour },
  { key: "uitgesloten", label: "Uitgesloten", style: reviewSummaryStatusStyles.uitgesloten },
] as const;

const TASK_EXECUTION_STEPS = [
  { id: "SELECTIE", position: 1, label: "Selectie" },
  { id: "BEOORDELING", position: 2, label: "Beoordeling" },
  { id: "ACCORDERING_PO", position: 3, label: "Accordering proceseigenaar" },
  { id: "ACCORDERING_ARCH", position: 4, label: "Accordering archivaris" },
  { id: "UITVOERING", position: 5, label: "Vernietigen" },
  { id: "RESULTAAT", position: 6, label: "Resultaat" },
] as const;

function getMetaIcon(label: string) {
  if (label === "Startdatum") {
    return <CalendarDays size={20} strokeWidth={1.8} />;
  }

  if (label === "Archivaris") {
    return <BriefcaseBusiness size={20} strokeWidth={1.8} />;
  }

  return <User size={20} strokeWidth={1.8} />;
}

export default function TaskExecutionHeader({
  title,
  activeStep,
  summaryStats,
  metaItems,
  showStatusOverview = true,
}: Props) {
  const { id } = useParams();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const taskTitle = useMemo(
    () => title ?? reviewRows.find((row) => row.id === id)?.titel ?? "Taakuitvoering",
    [id, title]
  );
  const activeStepMeta =
    TASK_EXECUTION_STEPS.find((step) => step.id === activeStep) ??
    TASK_EXECUTION_STEPS[1];
  const totalCount =
    summaryStats.teBeoordelen +
    summaryStats.akkoord +
    summaryStats.retour +
    summaryStats.uitgesloten;

  const statusItems = [
    { label: "Te beoordelen", count: summaryStats.teBeoordelen, style: reviewSummaryStatusStyles.teBeoordelen },
    { label: "Akkoord", count: summaryStats.akkoord, style: reviewSummaryStatusStyles.akkoord },
    { label: "Retour", count: summaryStats.retour, style: reviewSummaryStatusStyles.retour },
    { label: "Uitgesloten", count: summaryStats.uitgesloten, style: reviewSummaryStatusStyles.uitgesloten },
  ];

  return (
    <section className="relative border-b border-slate-200 bg-white">
      <div className="bg-white">
        <div className="flex h-[69px] items-center gap-5 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700">
            <ClipboardCheck size={24} strokeWidth={1.8} />
          </div>

          <div className="min-w-0 shrink-0">
            <h1 className="truncate text-[18px] font-semibold tracking-tight text-slate-950">
              {taskTitle}
            </h1>
          </div>

          <div className="min-w-0 flex-1">
            <nav className="truncate text-sm leading-5 text-slate-500">
              <span>Home</span>
              <span className="px-2">/</span>
              <span>Taken</span>
              <span className="px-2">/</span>
              <span>Taakuitvoering</span>
              <span className="px-2">/</span>
              <span className="text-slate-600">{taskTitle}</span>
            </nav>
            <p className="truncate text-[12.5px] font-medium leading-4 text-slate-500">
              Stap {activeStepMeta.position}/6
              <span className="px-1.5 text-slate-400">-</span>
              <span className="text-slate-700">{activeStepMeta.label}</span>
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-5">
            {showStatusOverview
              ? STAT_ITEMS.map((item) => (
                  <div key={item.key} className={`flex items-center gap-2.5 ${item.style.text}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${item.style.dot}`} />
                    <span className="text-[14px] font-semibold leading-none">
                      {summaryStats[item.key]}
                    </span>
                  </div>
                ))
              : null}

            <button
              type="button"
              onClick={() => setDetailsOpen((current) => !current)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              aria-expanded={detailsOpen}
              aria-label="Taakdetails tonen of verbergen"
            >
              <ChevronUp
                size={16}
                className={`transition-transform ${detailsOpen ? "" : "rotate-180"}`}
              />
            </button>
          </div>
        </div>
      </div>

      {detailsOpen ? (
        <div
          className={`absolute right-0 top-[calc(100%-1px)] z-20 overflow-hidden rounded-b-2xl border border-slate-200 border-t-0 bg-white shadow-xl shadow-slate-200/80 ${
            showStatusOverview ? "w-[636px]" : "w-[320px]"
          }`}
        >
          <div className={showStatusOverview ? "grid grid-cols-[1fr_1.08fr]" : ""}>
            <div className={`${showStatusOverview ? "border-r border-slate-200" : ""} px-6 py-6`}>
              <h2 className="text-[18px] font-semibold tracking-tight text-slate-950">
                Taakdetails
              </h2>

              <div className="mt-5 space-y-0">
                {metaItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-4 border-b border-slate-100 py-5 last:border-b-0 last:pb-0 first:pt-0"
                  >
                    <div className="shrink-0 pt-0.5 text-slate-700">
                      {getMetaIcon(item.label)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-slate-600">{item.label}</div>
                      <div className="mt-1 text-[15px] font-semibold text-slate-950">
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showStatusOverview ? (
              <div className="px-6 py-6">
                <h2 className="text-[18px] font-semibold tracking-tight text-slate-950">
                  Status overzicht
                </h2>
                <p className="mt-4 max-w-[250px] text-[15px] leading-7 text-slate-600">
                  Overzicht van de status van alle taken in dit contractdossier.
                </p>

                <div className="mt-6 space-y-0">
                  {statusItems.map((item) => {
                    const percentage = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;

                    return (
                      <div
                        key={item.label}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-slate-100 py-5"
                      >
                        <div className={`flex items-center gap-3 ${item.style.text}`}>
                          <span className={`h-3.5 w-3.5 rounded-full ${item.style.dot}`} />
                          <span className="text-[15px] font-medium">{item.label}</span>
                        </div>
                        <span className="text-[15px] font-medium text-slate-900">{item.count}</span>
                        <span className="text-[15px] font-medium text-slate-500">{percentage}%</span>
                      </div>
                    );
                  })}

                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-5">
                    <span className="text-[15px] font-semibold text-slate-950">Totaal</span>
                    <span className="text-[15px] font-semibold text-slate-950">{totalCount}</span>
                    <span className="text-[15px] font-semibold text-slate-950">100%</span>
                  </div>
                </div>

                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {statusItems.map((item) => {
                    const width = totalCount > 0 ? (item.count / totalCount) * 100 : 0;

                    return (
                      <div
                        key={`bar-${item.label}`}
                        className={`${item.style.progress} h-full first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${width}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
