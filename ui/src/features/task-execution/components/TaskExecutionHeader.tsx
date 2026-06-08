import type { ReactNode } from "react";
import {
  CheckCheck,
  CircleDotDashed,
} from "lucide-react";

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

type TaskExecutionHeaderStep = {
  id: string;
  label: string;
};

const workflowSteps: TaskExecutionHeaderStep[] = [
  { id: "SELECTIE", label: "Selectie" },
  { id: "BEOORDELING", label: "Beoordeling" },
  { id: "ACCORDERING_PO", label: "Accordering" },
  { id: "ACCORDERING_ARCH", label: "Accordering" },
  { id: "UITVOERING", label: "Uitvoering" },
  { id: "RESULTAAT", label: "Resultaat" },
];

function getWorkflowStepState(
  index: number,
  activeIndex: number
): "done" | "active" | "todo" {
  if (index < activeIndex) {
    return "done";
  }

  if (index === activeIndex) {
    return "active";
  }

  return "todo";
}

function getWorkflowStepStyles(state: "done" | "active" | "todo") {
  if (state === "done") {
    return {
      icon: "border-slate-200 bg-white text-slate-500",
      label: "text-slate-700",
      line: "bg-slate-200",
    };
  }

  if (state === "active") {
    return {
      icon: "border-blue-600 bg-blue-50 text-blue-700",
      label: "text-blue-700",
      line: "bg-slate-200",
    };
  }

  return {
    icon: "border-slate-200 bg-white text-slate-400",
    label: "text-slate-500",
    line: "bg-slate-200",
  };
}

type Props = {
  activeStep: string;
  summaryStats: TaskExecutionHeaderSummaryStats;
  metaItems: TaskExecutionHeaderMetaItem[];
};

export type {
  TaskExecutionHeaderMetaItem,
  TaskExecutionHeaderSummaryStats,
};

export default function TaskExecutionHeader({
  activeStep,
  summaryStats,
  metaItems,
}: Props) {
  const activeIndex = workflowSteps.findIndex((step) => step.id === activeStep);

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2.5">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch xl:justify-between">
          <div className="min-w-0 flex-1 overflow-x-auto xl:overflow-visible">
            <div className="flex min-w-max items-start gap-1.5 pb-0.5 xl:min-w-0 xl:w-full xl:gap-2">
              {workflowSteps.map((step, index) => {
                const isLast = index === workflowSteps.length - 1;
                const state = getWorkflowStepState(index, activeIndex);
                const styles = getWorkflowStepStyles(state);

                return (
                  <div
                    key={step.id}
                    className="flex min-w-[62px] items-start xl:min-w-0 xl:flex-1"
                  >
                    <div className="flex min-w-0 flex-col items-center text-center xl:w-full">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${styles.icon}`}
                        aria-hidden="true"
                      >
                        {state === "done" ? (
                          <CheckCheck size={10} strokeWidth={2.2} />
                        ) : state === "active" ? (
                          <CircleDotDashed size={10} strokeWidth={2.2} />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      <div className={`mt-1.5 text-[10px] font-medium leading-4 whitespace-nowrap ${styles.label}`}>
                        {step.label}
                      </div>
                    </div>

                    {!isLast && (
                      <div className={`mt-2.5 h-px min-w-4 flex-1 xl:min-w-2 ${styles.line}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 border-slate-200 sm:grid-cols-4 xl:min-w-[332px] xl:border-l">
            {[
              { label: "Te beoordelen", value: summaryStats.teBeoordelen, tone: "text-blue-700" },
              { label: "Akkoord", value: summaryStats.akkoord, tone: "text-emerald-600" },
              { label: "Retour", value: summaryStats.retour, tone: "text-amber-600" },
              { label: "Uitgesloten", value: summaryStats.uitgesloten, tone: "text-rose-600" },
            ].map((item, index) => (
              <div
                key={item.label}
                className={`px-3 py-0.5 sm:px-3.5 ${
                  index > 0 ? "sm:border-l sm:border-slate-200" : ""
                } ${index % 2 === 1 ? "border-l border-slate-200 sm:border-l" : ""}`}
              >
                <div className="text-[10px] font-medium text-slate-600 sm:text-[11px]">{item.label}:</div>
                <div className={`mt-1 text-lg font-semibold leading-none sm:text-[1.05rem] ${item.tone}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
        {metaItems.map((item, index) => (
          <div
            key={item.label}
            className={`flex items-center gap-2.5 px-5 py-2.5 ${
              index > 0 ? "border-t border-slate-100 md:border-t-0" : ""
            } ${index > 0 ? "xl:border-l xl:border-slate-200" : ""} ${
              index === 1 ? "md:border-l md:border-slate-200 xl:border-l" : ""
            } ${index === 3 ? "md:border-l md:border-slate-200" : ""}`}
          >
            <div className="shrink-0 text-slate-500">{item.icon}</div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium leading-4 text-slate-500">{item.label}:</div>
              <div className="mt-0.5 truncate text-sm font-semibold leading-5 text-slate-900">
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
