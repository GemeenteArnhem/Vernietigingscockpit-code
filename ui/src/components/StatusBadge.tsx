type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

type Props = {
  status: string;

  size?: "sm" | "md";
};

const statusConfig: Record<
  string,
  {
    label: string;
    variant: StatusVariant;
  }
> = {
  /* -------------------------------- */
  /* TASK / WORKFLOW */
  /* -------------------------------- */

  LOPEND: {
    label: "Lopend",
    variant: "success",
  },

  GEPLAND: {
    label: "Gepland",
    variant: "warning",
  },

  VERTRAAGD: {
    label: "Vertraagd",
    variant: "danger",
  },

  IDLE: {
    label: "Idle",
    variant: "neutral",
  },

  VOLTOOID: {
    label: "Voltooid",
    variant: "success",
  },

  /* -------------------------------- */
  /* CONNECTORS */
  /* -------------------------------- */

  GEKOPPELD: {
    label: "Gekoppeld",
    variant: "success",
  },

  OK: {
    label: "Ok",
    variant: "success",
  },

  ACTIEF_CONNECTOR: {
    label: "Actief",
    variant: "success",
  },

  INACTIEF: {
    label: "Inactief",
    variant: "neutral",
  },

  FOUT: {
    label: "Fout",
    variant: "danger",
  },

  WAARSCHUWING: {
    label: "Waarschuwing",
    variant: "warning",
  },

  /* -------------------------------- */
  /* APPROVAL */
  /* -------------------------------- */

  GOEDGEKEURD: {
    label: "Goedgekeurd",
    variant: "success",
  },

  SUCCES: {
    label: "Succes",
    variant: "success",
  },

  AFGEWEZEN: {
    label: "Afgewezen",
    variant: "danger",
  },

  IN_BEHANDELING: {
    label: "Onderhanden",
    variant: "info",
  },

  NIET_GEVONDEN: {
    label: "Niet gevonden",
    variant: "warning",
  },

  OVERIG: {
    label: "Overig",
    variant: "neutral",
  },
};

const variantStyles: Record<
  StatusVariant,
  string
> = {
  success:
    "bg-green-50 text-green-700 border-green-200",

  warning:
    "bg-amber-50 text-amber-700 border-amber-200",

  danger:
    "bg-red-50 text-red-700 border-red-200",

  info:
    "bg-blue-50 text-blue-700 border-blue-200",

  neutral:
    "bg-gray-100 text-gray-700 border-gray-200",
};

export default function StatusBadge({
  status,
  size = "sm",
}: Props) {
  const config =
    statusConfig[
      status.toUpperCase()
    ] ?? {
      label: status,
      variant: "neutral",
    };

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-md
        border
        font-medium
        whitespace-nowrap

        ${
          size === "sm"
            ? `
              px-2
              py-0.5
              text-xs
            `
            : `
              px-2.5
              py-1
              text-sm
            `
        }

        ${
          variantStyles[
            config.variant
          ]
        }
      `}
    >
      {config.label}
    </span>
  );
}
