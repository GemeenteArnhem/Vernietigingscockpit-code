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
    | "WAARSCHUWING"
    | "SUCCES";
};

type Props = {
  connectors: Connector[];
};

export default function ConnectorTable({
  connectors,
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

              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
