import StatusBadge from "../../../components/StatusBadge";
import TaskProgress from "../../../components/TaskProgress";

export type TaskDefinition = {
  id: string;
  naam: string;
  taakId: string;
  proceseigenaar: string;
  rol: string;
  stekkers: string[];
  frequentie: string;
  volgendeStartdatum?: string;
  relatieveDatum?: string;
  status: 'ACTIEF' | 'GEPLAND' | 'IDLE' | 'VERTRAAGD';
  actieveInstantieId?: string | null;
  huidigeStap?: string;
  voortgang?: number;
  dagenInStap?: number;
  vertraagd?: boolean;
};

type Props = {
  rows: TaskDefinition[];
  onRowClick?: (id: string) => void;
};

export default function TaskDefinitionTable({
  rows,
  onRowClick,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-xs uppercase text-gray-500 h-12">
              <th className="sticky left-0 bg-gray-50 px-6 text-left w-[220px]">
                Taaknaam
              </th>
              <th className="px-4 text-left w-[180px]">
                Proceseigenaar
              </th>
              <th className="px-4 text-left w-[80px]">
                # Stekkers
              </th>
              <th className="px-4 text-left w-[120px]">
                Frequentie
              </th>
              <th className="px-4 text-left w-[120px]">
                Volgende uitvoering
              </th>
              <th className="px-4 text-left w-[240px]">
                Voortgang
              </th>
              <th className="px-4 text-left w-[120px]">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.id)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors h-[78px]"
              >
                <td className="sticky left-0 bg-white px-6">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">
                      {row.naam}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      {row.taakId}
                    </span>
                  </div>
                </td>

                <td className="px-4">
                  <div className="flex flex-col">
                    <span>{row.proceseigenaar}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      Rol: {row.rol}
                    </span>
                  </div>
                </td>

                <td className="px-4">
                  <div title={row.stekkers.join(', ')}>
                    {row.stekkers.length} stekkers
                  </div>
                </td>

                <td className="px-4">
                  <div className="flex flex-col">
                    <span>{row.frequentie}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {row.volgendeStartdatum || '—'}
                    </span>
                  </div>
                </td>

                <td className="px-4">
                  <div className="flex flex-col">
                    <span>{row.volgendeStartdatum || '—'}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {row.relatieveDatum || '—'}
                    </span>
                  </div>
                </td>

                <td className="px-4">
                  {row.actieveInstantieId ? (
                    <TaskProgress
                      percentage={row.voortgang || 0}
                      stap={row.huidigeStap || '-'}
                      dagen={row.dagenInStap || 0}
                      vertraagd={row.vertraagd}
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">
                      Gepland
                    </span>
                  )}
                </td>

                <td className="px-4">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
