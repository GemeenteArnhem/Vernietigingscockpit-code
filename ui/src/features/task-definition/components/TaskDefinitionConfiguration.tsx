import ConnectorTable, {
  type Connector,
} from "./ConnectorTable";

export type TaskDefinitionConfigurationData =
  {
    taaknaam: string;
    categorie?: string;
    frequentie: string;
    proceseigenaar: string;
    archivaris: string;
  };

type Props = {
  configuratie:
    TaskDefinitionConfigurationData;

  stekkers: Connector[];

  onOpenConnector?: (
    connectorId: string
  ) => void;

  onEditGeneral?: () => void;

  onEditRoles?: () => void;

  onAddConnector?: () => void;
};

type FieldProps = {
  label: string;
  value?: string;
};

function Field({
  label,
  value,
}: FieldProps) {
  return (
    <div>
      <div
        className="
          text-sm
          text-gray-500
          mb-1
        "
      >
        {label}
      </div>

      <div
        className="
          text-[15px]
          font-medium
          text-gray-900
        "
      >
        {value || "—"}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
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
        <h3
          className="
            text-base
            font-semibold
            text-gray-900
          "
        >
          {title}
        </h3>

        {onEdit && (
          <button
            onClick={onEdit}
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
            Bewerken
          </button>
        )}
      </div>

      {/* CONTENT */}
      <div
        className="
          px-5
          py-4
          flex
          flex-col
          gap-5
        "
      >
        {children}
      </div>
    </div>
  );
}

export default function TaskDefinitionConfiguration({
  configuratie,
  stekkers,
  onOpenConnector,
  onEditGeneral,
  onEditRoles,
  onAddConnector,
}: Props) {
  return (
    <div className="flex flex-col gap-5">

      {/* TOP GRID */}
      <div
        className="
          grid
          grid-cols-2
          gap-5
        "
      >
        {/* ALGEMEEN */}
        <SectionCard
          title="Algemeen"
          onEdit={
            onEditGeneral
          }
        >
          <Field
            label="Taaknaam"
            value={
              configuratie.taaknaam
            }
          />

          <Field
            label="Frequentie"
            value={
              configuratie.frequentie
            }
          />
        </SectionCard>

        {/* VERANTWOORDELIJKEN */}
        <SectionCard
          title="Verantwoordelijken"
          onEdit={
            onEditRoles
          }
        >
          <Field
            label="Proceseigenaar"
            value={
              configuratie.proceseigenaar
            }
          />

          <Field
            label="Archivaris"
            value={
              configuratie.archivaris
            }
          />
        </SectionCard>
      </div>

      {/* STEKKERS */}
      <ConnectorTable
        connectors={stekkers}
        onOpen={
          onOpenConnector
        }
        onAdd={
          onAddConnector
        }
      />
    </div>
  );
}