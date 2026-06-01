type TaskMetaItem = {
  label: string;
  value: string;
};

type TaskMetaBarProps = {
  items: TaskMetaItem[];
  variant?: "default" | "embedded";
};

export default function TaskMetaBar({
  items,
  variant = "default",
}: TaskMetaBarProps) {
  return (
    <section
      className={
        variant === "embedded"
          ? "px-0 py-0"
          : "rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
      }
    >
      <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          return (
            <div key={`${item.label}-${index}`}>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {item.label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {item.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
