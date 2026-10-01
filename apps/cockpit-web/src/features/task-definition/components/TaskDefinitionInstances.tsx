import StatusBadge from "../../../components/StatusBadge";
import type { TaskDefinitionInstance } from "../../../shared/types/taskDefinition";

type Props = {
  instanties:
    TaskDefinitionInstance[];

  onOpen?: (
    id: string
  ) => void;
};

function ProgressBar({
  value,
  status,
}: {
  value: number;
  status: string;
}) {
  const barColor =
    status ===
    "VERTRAAGD"
      ? "bg-red-500"
      : status ===
          "VOLTOOID"
        ? "bg-green-500"
        : "bg-blue-500";

  if (value <= 0) {
    return (
      <span className="text-gray-400 text-sm">
        —
      </span>
    );
  }

  return (
    <div className="min-w-[180px]">
      <div
        className="
          flex
          items-center
          justify-between
          mb-1
        "
      >
        <span
          className="
            text-sm
            text-gray-700
          "
        >
          {status ===
          "VOLTOOID"
            ? "Vernietiging"
            : "Beoordeling"}
        </span>

        <span
          className="
            text-sm
            text-gray-500
          "
        >
          {value}%
        </span>
      </div>

      <div
        className="
          h-1.5
          rounded-full
          bg-gray-100
          overflow-hidden
        "
      >
        <div
          className={`
            h-full
            rounded-full
            ${barColor}
          `}
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function TaskDefinitionInstances({
  instanties,
  onOpen,
}: Props) {
  return (
  <div
    className="
      bg-white
      border
      border-gray-200
      rounded-md
      overflow-hidden
    "
  >
    {/* HEADER */}
    <div
      className="
        px-5
        py-3
        border-b
        border-gray-200
        bg-white
      "
    >
      <h3
        className="
          text-base
          font-semibold
          text-gray-900
        "
      >
        Uitvoeringen
      </h3>

      <p
        className="
          text-sm
          text-gray-500
          mt-0.5
        "
      >
        Geplande, lopende en
        afgeronde instanties
      </p>
    </div>

    {/* TABLE */}
      <table className="w-full">
        <thead>
          <tr
            className="
              border-b
              border-gray-200
              bg-gray-50
            "
          >
            <th
              className="
                text-left
                px-4
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
              "
            >
              Instantie
            </th>

            <th
              className="
                text-left
                px-4
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
                w-[220px]
              "
            >
              Recordmanager
            </th>

            <th
              className="
                text-left
                px-4
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
                w-[180px]
              "
            >
              Status
            </th>

            <th
              className="
                text-left
                px-4
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
                w-[280px]
              "
            >
              Voortgang
            </th>
          </tr>
        </thead>

        <tbody>
          {instanties.map(
            (instantie) => (
              <tr
                key={
                  instantie.id
                }
                className={`
                  ${onOpen ? "cursor-pointer" : ""}
                  border-b
                  border-gray-100
                  last:border-0
                  transition-colors
                  hover:bg-gray-50

                  ${
                    instantie.highlighted
                      ? `
                        bg-blue-50
                    `
                      : ""
                  }
                `}
                onClick={() =>
                  onOpen?.(
                    instantie.id
                  )
                }
              >
                {/* instantie */}
                <td
                  className="
                    px-4
                    py-4
                  "
                >
                  <div
                    className="
                      text-[15px]
                      font-medium
                      text-gray-900
                    "
                  >
                    {
                      instantie.naam
                    }
                  </div>

                  <div
                    className="
                      text-sm
                      text-gray-500
                      mt-0.5
                    "
                  >
                    {
                      instantie.subtitle
                    }
                  </div>
                </td>

                {/* RM */}
                <td
                  className="
                    px-4
                    py-4
                    text-sm
                    text-gray-700
                  "
                >
                  {
                    instantie.recordmanager
                  }
                </td>

                {/* status */}
                <td
                  className="
                    px-4
                    py-4
                  "
                >
                  <StatusBadge
                    status={
                      instantie.status
                    }
                  />
                </td>

                {/* voortgang */}
                <td
                  className="
                    px-4
                    py-4
                  "
                >
                  <ProgressBar
                    value={
                      instantie.voortgang
                    }
                    status={
                      instantie.status
                    }
                  />
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>

      {/* FOOTER */}
      <div
        className="
          flex
          items-center
          justify-center
          py-4
          bg-white
          border-t
          border-gray-100
        "
      >
        <button
          className="
            inline-flex
            items-center
            gap-2
            px-4
            py-2
            text-sm
            text-gray-700
            border
            border-gray-300
            rounded-lg
            hover:bg-gray-50
            transition-colors
          "
        >
          Meer laden

          <span
            className="
              text-gray-400
              text-xs
            "
          >
            ▼
          </span>
        </button>
      </div>
    </div>
  );
}
