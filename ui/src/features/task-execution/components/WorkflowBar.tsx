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
  { id: "UITVOERING", label: "Uitvoering" },
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

export default function WorkflowBar({
  activeStep = "BEOORDELING",
  variant = "default",
}: Props) {
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  return (
    <div
      className={
        variant === "embedded"
          ? "px-0 py-0"
          : "rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
      }
    >
      <div className="flex items-start justify-between gap-3 overflow-x-auto">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const state = getStepState(index, activeIndex);

          return (
            <div key={step.id} className="flex min-w-[136px] flex-1 items-center">
              <div className="flex min-w-0 items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                    state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : state === "active"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
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
                  <span
                    className={`text-sm font-semibold ${
                      state === "active"
                        ? "text-slate-950"
                        : state === "done"
                          ? "text-slate-800"
                          : "text-slate-500"
                    }`}
                  >
                    {step.label}
                  </span>

                  {step.sublabel && (
                    <span
                      className={`text-xs ${
                        state === "active" ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {step.sublabel}
                    </span>
                  )}
                </div>
              </div>

              {!isLast && (
                <div
                  className={`mx-3 mt-4 h-px flex-1 ${
                    state === "done" ? "bg-emerald-200" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
