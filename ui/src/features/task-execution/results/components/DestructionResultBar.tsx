import type { DestructionResultRow, DestructionResultStatus } from "../../../../shared/types/destructionResult";

type Props = {
  rows: DestructionResultRow[];
};

const STAT_ORDER: {
  key: DestructionResultStatus;
  label: string;
  color: string;
  ring: string;
}[] = [
  {
    key: "SUCCES",
    label: "Succes",
    color: "text-green-700",
    ring: "bg-green-500",
  },
  {
    key: "FOUT",
    label: "Fouten",
    color: "text-red-700",
    ring: "bg-red-500",
  },
  {
    key: "NIET_GEVONDEN",
    label: "Niet gevonden",
    color: "text-amber-700",
    ring: "bg-amber-500",
  },
  {
    key: "OVERIG",
    label: "Overige",
    color: "text-gray-700",
    ring: "bg-gray-500",
  },
];

export default function DestructionResultBar({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        {STAT_ORDER.map((stat) => {
          const count = rows.filter(
            (row) => row.vernietigingsstatus === stat.key
          ).length;

          return (
            <div
              key={stat.key}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${stat.ring}`} />
                <span className="text-sm font-medium text-gray-600">
                  {stat.label}
                </span>
              </div>

              <span className={`text-lg font-semibold ${stat.color}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
