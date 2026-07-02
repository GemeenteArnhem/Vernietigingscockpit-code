import {
  CheckCheck,
  Circle,
  CircleDotDashed,
} from "lucide-react";

type Step = {
  id: string;
  label: string;
  sublabel?: string;
};

type Props = {
  activeStep?: string;
  variant?: "default" | "embedded";
};

const steps: Step[] = [
  { id: "SELECTIE", label: "Selectie" },
  { id: "BEOORDELING", label: "Beoordeling" },
  { id: "ACCORDERING_PO", label: "Accordering", sublabel: "Proceseigenaar" },
  { id: "ACCORDERING_ARCH", label: "Accordering", sublabel: "Archivaris" },
  { id: "UITVOERING", label: "Vernietigen" },
  { id: "RESULTAAT", label: "Resultaat" },
];

function getStepState(
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

function getStepStyles(state: "done" | "active" | "todo") {
  if (state === "done") {
    return {
      icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "text-slate-800",
      sublabel: "text-slate-400",
      line: "bg-emerald-200",
      card: "border-emerald-100 bg-emerald-50/50",
    };
  }

  if (state === "active") {
    return {
      icon: "border-blue-200 bg-blue-50 text-blue-700",
      label: "text-slate-950",
      sublabel: "text-slate-500",
      line: "bg-slate-200",
      card: "border-blue-100 bg-blue-50/50",
    };
  }

  return {
    icon: "border-slate-200 bg-slate-50 text-slate-400",
    label: "text-slate-500",
    sublabel: "text-slate-400",
    line: "bg-slate-200",
    card: "border-slate-200 bg-slate-50/60",
  };
}

export default function WorkflowBar({
  activeStep = "BEOORDELING",
  variant = "default",
}: Props) {
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  const isEmbedded = variant === "embedded";

  return (
    <div
      className={
        isEmbedded
          ? "px-0 py-0"
          : "rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
      }
    >
      {isEmbedded ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 md:hidden">
            {steps.map((step, index) => {
              const state = getStepState(index, activeIndex);
              const styles = getStepStyles(state);

              return (
                <div
                  key={step.id}
                  className={`rounded-md border px-3 py-3 ${styles.card}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${styles.icon}`}
                      aria-hidden="true"
                    >
                      {state === "done" ? (
                        <CheckCheck size={16} strokeWidth={2.2} />
                      ) : state === "active" ? (
                        <CircleDotDashed size={16} strokeWidth={2.2} />
                      ) : (
                        <Circle size={14} strokeWidth={2} />
                      )}
                    </div>

                    <div className="min-w-0 leading-snug">
                      <span className={`block text-sm font-semibold ${styles.label}`}>
                        {step.label}
                      </span>

                      {step.sublabel && (
                        <span className={`mt-0.5 block text-xs ${styles.sublabel}`}>
                          {step.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden items-start gap-2 md:flex">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const state = getStepState(index, activeIndex);
              const styles = getStepStyles(state);

              return (
                <div key={step.id} className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <div className={`min-h-[2rem] text-[13px] font-semibold leading-tight ${styles.label} break-words`}>
                    {step.label}
                  </div>

                  <div className="mt-2 flex w-full items-center gap-2">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${styles.icon}`}
                      aria-hidden="true"
                    >
                      {state === "done" ? (
                        <CheckCheck size={14} strokeWidth={2.2} />
                      ) : state === "active" ? (
                        <CircleDotDashed size={14} strokeWidth={2.2} />
                      ) : (
                        <Circle size={12} strokeWidth={2} />
                      )}
                    </div>

                    {!isLast && (
                      <div className={`h-px min-w-3 flex-1 ${styles.line}`} />
                    )}
                  </div>

                  <div className={`mt-2 min-h-[1.75rem] text-[11px] leading-tight ${styles.sublabel}`}>
                    {step.sublabel ?? ""}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3 overflow-x-auto">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const state = getStepState(index, activeIndex);
          const styles = getStepStyles(state);

          return (
            <div key={step.id} className="flex min-w-[136px] flex-1 items-center">
              <div className="flex min-w-0 items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${styles.icon}`}
                  aria-hidden="true"
                >
                  {state === "done" ? (
                    <CheckCheck size={16} strokeWidth={2.2} />
                  ) : state === "active" ? (
                    <CircleDotDashed size={16} strokeWidth={2.2} />
                  ) : (
                    <Circle size={14} strokeWidth={2} />
                  )}
                </div>

                <div className="flex min-w-0 flex-col leading-snug">
                  <span className={`text-sm font-semibold ${styles.label}`}>
                    {step.label}
                  </span>

                  {step.sublabel && (
                    <span className={`text-xs ${styles.sublabel}`}>
                      {step.sublabel}
                    </span>
                  )}
                </div>
              </div>

              {!isLast && (
                <div className={`mx-3 mt-4 h-px flex-1 ${styles.line}`} />
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
