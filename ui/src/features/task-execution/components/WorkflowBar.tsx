type Step = {
  id: string;
  label: string;
  sublabel?: string;
};

type Props = {
  activeStep?: string;
};

const steps: Step[] = [
  { id: "SELECTIE", label: "Selectie" },
  { id: "BEOORDELING", label: "Beoordeling" },
  { id: "ACCORDERING_PO", label: "Accordering", sublabel: "Proceseigenaar" },
  { id: "ACCORDERING_ARCH", label: "Accordering", sublabel: "Archivaris" },
  { id: "UITVOERING", label: "Uitvoering" },
  { id: "RESULTAAT", label: "Resultaat" },
];

export default function WorkflowBar({
  activeStep = "BEOORDELING",
}: Props) {
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  return (
    <div className="mb-2 rounded-xl border border-gray-200 px-4 py-2.5">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const state =
            index < activeIndex
              ? "done"
              : index === activeIndex
                ? "active"
                : "todo";

          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-[140px] items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    state === "done"
                      ? "bg-green-100 text-green-700"
                      : state === "active"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {state === "done" ? "OK" : index + 1}
                </div>

                <div className="flex flex-col leading-snug">
                  <span className="text-sm font-medium text-gray-700">
                    {step.label}
                  </span>

                  {step.sublabel && (
                    <span className="text-xs text-gray-400">
                      {step.sublabel}
                    </span>
                  )}
                </div>
              </div>

              {!isLast && (
                <div className="mx-3 h-px flex-1 bg-gray-200" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
