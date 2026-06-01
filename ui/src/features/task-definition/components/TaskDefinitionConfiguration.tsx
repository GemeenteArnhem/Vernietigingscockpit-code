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
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <div
        className="
          text-sm
          text-gray-500
        "
      >
        {label}
      </div>

      <div
        className="
          text-[15px]
          text-right
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
          {title}
        </h3>
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
        <SectionCard title="Algemeen">
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
        <SectionCard title="Verantwoordelijken">
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
      />
    </div>
  );
}
