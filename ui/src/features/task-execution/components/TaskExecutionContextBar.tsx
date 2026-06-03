import TaskMetaBar from "../../../components/TaskMetaBar";
import WorkflowBar from "./WorkflowBar";

type TaskExecutionContextBarItem = {
  label: string;
  value: string;
};

type Props = {
  activeStep: string;
  items: TaskExecutionContextBarItem[];
};

export default function TaskExecutionContextBar({
  activeStep,
  items,
}: Props) {
  return (
    <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-3">
        <WorkflowBar activeStep={activeStep} variant="embedded" />

        <div className="border-t border-slate-100 pt-3">
          <TaskMetaBar items={items} variant="embedded" />
        </div>
      </div>
    </section>
  );
}
