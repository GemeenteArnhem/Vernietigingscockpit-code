import StatusBadge from "../../../components/StatusBadge";

export type Connector = {
  id?: string;
  naam: string;
  type: string;
  omschrijving?: string;

  status:
    | "GEKOPPELD"
    | "ACTIEF_CONNECTOR"
    | "INACTIEF"
    | "FOUT"
    | "WAARSCHUWING";
};

type Props = {
  connectors: Connector[];

  onOpen?: (
    connectorId: string
  ) => void;

  onAdd?: () => void;
};

export default function ConnectorTable({
  connectors,
  onOpen,
  onAdd,
}: Props) {
  return (
    <div
      className="
        bg-white
        border
        border-gray-200
        rounded-2xl
        overflow-hidden
      "
    >
      {/* HEADER */}
      <div
        className="
          flex
          items-center
          justify-between
          px-5
          py-4
          border-b
          border-gray-200
          bg-white
        "
      >
        <div>
          <h3
            className="
              text-base
              font-semibold
              text-gray-900
            "
          >
            Stekkers
          </h3>

          <p
            className="
              text-sm
              text-gray-500
              mt-0.5
            "
          >
            Gekoppelde bronnen
            voor deze taak
          </p>
        </div>

        {onAdd && (
          <button
            onClick={onAdd}
            className="
              inline-flex
              items-center
              justify-center
              h-10
              px-4
              text-sm
              font-medium
              text-gray-700
              bg-white
              border
              border-gray-300
              rounded-lg
              hover:bg-gray-50
              transition-colors
            "
          >
            + Toevoegen
          </button>
        )}
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
                px-5
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
              "
            >
              Naam
            </th>

            <th
              className="
                text-left
                px-5
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
              "
            >
              Type
            </th>

            <th
              className="
                text-left
                px-5
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
              "
            >
              Omschrijving
            </th>

            <th
              className="
                text-left
                px-5
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
                text-right
                px-5
                py-3
                text-xs
                uppercase
                tracking-wide
                text-gray-500
                font-semibold
                w-[140px]
              "
            >
              Actie
            </th>
          </tr>
        </thead>

        <tbody>
          {connectors.map(
            (connector) => (
              <tr
                key={
                  connector.id ??
                  connector.naam
                }
                className="
                  border-b
                  border-gray-100
                  last:border-0
                  hover:bg-gray-50
                  transition-colors
                "
              >
                {/* naam */}
                <td
                  className="
                    px-5
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
                      connector.naam
                    }
                  </div>
                </td>

                {/* type */}
                <td
                  className="
                    px-5
                    py-4
                    text-sm
                    text-gray-700
                  "
                >
                  {
                    connector.type
                  }
                </td>

                {/* omschrijving */}
                <td
                  className="
                    px-5
                    py-4
                    text-sm
                    text-gray-600
                  "
                >
                  {connector.omschrijving ||
                    "—"}
                </td>

                {/* status */}
                <td
                  className="
                    px-5
                    py-4
                  "
                >
                  <StatusBadge
                    status={
                      connector.status
                    }
                  />
                </td>

                {/* actie */}
                <td
                  className="
                    px-5
                    py-4
                    text-right
                  "
                >
                  <button
                    onClick={() =>
                      connector.id &&
                      onOpen?.(
                        connector.id
                      )
                    }
                    className="
                      inline-flex
                      items-center
                      justify-center
                      h-10
                      px-4
                      text-sm
                      font-medium
                      text-gray-700
                      bg-white
                      border
                      border-gray-300
                      rounded-lg
                      hover:bg-gray-50
                      transition-colors
                    "
                  >
                    Open
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
