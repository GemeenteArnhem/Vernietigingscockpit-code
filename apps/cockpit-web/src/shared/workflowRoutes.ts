import type { DashboardWorkflowStepId } from "./types/dashboard";

export function getTaskExecutionRoute(input: {
  taakdefinitieId: string;
  taakinstantieId: string;
  stap?: string;
  stapId?: DashboardWorkflowStepId;
}) {
  const base = `/taak/${input.taakdefinitieId}/taakuitvoering/${input.taakinstantieId}`;
  const normalizedStep = input.stap?.toLowerCase() ?? "";

  if (normalizedStep === "vrijgegeven") {
    return `${base}/uitvoering`;
  }

  switch (input.stapId ?? stepIdFromLabel(normalizedStep)) {
    case "BEOORDELING":
      return `${base}/beoordeling`;
    case "ACCORDERING_PO":
      return `${base}/accordering/proceseigenaar`;
    case "ACCORDERING_ARCH":
      return `${base}/accordering/archivaris`;
    case "UITVOERING":
      return `${base}/uitvoering`;
    case "RESULTAAT":
      return `${base}/resultaat`;
    case "SELECTIE":
    default:
      return `${base}/selectie`;
  }
}

function stepIdFromLabel(label: string): DashboardWorkflowStepId {
  switch (label) {
    case "beoordeling":
      return "BEOORDELING";
    case "accordering proceseigenaar":
      return "ACCORDERING_PO";
    case "accordering archivaris":
      return "ACCORDERING_ARCH";
    case "uitvoering":
      return "UITVOERING";
    case "resultaat":
    case "archief":
      return "RESULTAAT";
    default:
      return "SELECTIE";
  }
}
