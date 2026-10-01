import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCheck,
  SendToBack,
} from "lucide-react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
  ActionPanelTextarea,
} from "../components/ActionPanel";
import ShortcutPane from "../components/ShortcutPane";
import ConfirmDialog from "../components/ConfirmDialog";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import ReviewRecordPanel from "../features/task-execution/review/components/ReviewRecordPanel";
import type {
  ReviewRecordSortDirection,
  ReviewRecordSortKey,
} from "../features/task-execution/review/components/ReviewRecordPanel";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  getReviewCandidates,
  submitArchivarisAccordering,
  updateArchivarisAccordering,
  type UpdateProceseigenaarAccorderingInput,
} from "../api/f3Data";
import { useSessionUser } from "../auth/useSessionUser";
import { getReviewQueueStatusStyle } from "../shared/ui/reviewStatusStyles";
import type {
  ReviewComment,
  ReviewDecision,
  ReviewQueueStatus,
  ReviewRiskLevel,
  ReviewRecordContext,
} from "../shared/types/review";
import type { VernietigingsKandidaat } from "../shared/types/destruction";

type ReviewStatusFilter =
  | "alle"
  | "nog-te-beoordelen"
  | "retour"
  | "conflict"
  | "afgerond"
  | "uitgesteld";
type ReviewRiskFilter = "alle" | ReviewRiskLevel;
type ReviewAction = "open" | "akkoord" | "retour";

const BULK_SELECTION_KEY = "__bulk__";

function getDecisionStatus(decision: ReviewDecision): ReviewQueueStatus {
  switch (decision) {
    case "akkoord":
      return "afgerond";
    case "uitsluiten":
      return "conflict";
    case "retour":
      return "retour";
    default:
      return "nog-te-beoordelen";
  }
}

function getQueueStatusLabel(status: ReviewQueueStatus) {
  switch (status) {
    case "afgerond":
      return "Akkoord";
    case "conflict":
      return "Uitgesloten";
    case "retour":
      return "Retour";
    case "uitgesteld":
      return "Uitgesteld";
    default:
      return "Open";
  }
}

function getQueueStatusBadgeClasses(status: ReviewQueueStatus) {
  return getReviewQueueStatusStyle(status).badge;
}

function getSharedValue(values: string[], multipleLabel = "Meerdere") {
  const normalizedValues = Array.from(new Set(values.filter(Boolean)));

  if (normalizedValues.length === 0) {
    return "-";
  }

  return normalizedValues.length === 1 ? normalizedValues[0] : multipleLabel;
}

const reviewActions = [
  {
    id: "akkoord" as const,
    title: "Akkoord",
    icon: <CheckCheck size={18} />,
    tone: "success" as const,
  },
  {
    id: "retour" as const,
    title: "Retour",
    icon: <SendToBack size={18} />,
    tone: "warning" as const,
  },
];

function mapActionToApiInput(
  action: ReviewAction,
  toelichting: string
): UpdateProceseigenaarAccorderingInput | null {
  const normalizedToelichting = toelichting.trim() || null;

  switch (action) {
    case "akkoord":
      return {
        besluit: "AKKOORD",
        toelichting: normalizedToelichting,
      };
    case "retour":
      return {
        besluit: "RETOUR",
        toelichting: normalizedToelichting,
      };
    default:
      return null;
  }
}

export default function ArchivistApprovalPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const { accessToken } = useSessionUser();

  const [search] = useState("");
  const [activeStatusFilter] =
    useState<ReviewStatusFilter>("alle");
  const [activeRiskFilter] = useState<ReviewRiskFilter>("alle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisions, setDecisions] =
    useState<Record<string, ReviewDecision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [deferredRecords, setDeferredRecords] = useState<Record<string, boolean>>({});
  const [selectedActions, setSelectedActions] = useState<Record<string, ReviewAction>>({});
  const [manualComments, setManualComments] = useState<Record<string, ReviewComment[]>>({});
  const [apiRows, setApiRows] = useState<VernietigingsKandidaat[] | null>(null);
  const [apiContexts, setApiContexts] = useState<ReviewRecordContext[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ReviewRecordSortKey>("vernietigingsdatum");
  const [sortDirection, setSortDirection] =
    useState<ReviewRecordSortDirection>("asc");
  const collator = useMemo(
    () => new Intl.Collator("nl", { numeric: true, sensitivity: "base" }),
    []
  );

  useEffect(() => {
    if (!accessToken || !id) {
      return;
    }

    let isCurrent = true;

    getReviewCandidates(accessToken, id)
      .then(({ rows, contexts, decisions: apiDecisions }) => {
        if (!isCurrent) {
          return;
        }

        setApiRows(rows);
        setApiContexts(contexts);
        setDecisions(apiDecisions);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => {
        if (isCurrent) {
          setApiRows([]);
          setApiContexts([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, id]);

  const sourceRows = apiRows ?? [];
  const sourceContexts = apiContexts ?? [];

  const contextById = useMemo(
    () => Object.fromEntries(sourceContexts.map((context) => [context.recordId, context])),
    [sourceContexts]
  );

  const queueRows = useMemo(
    () =>
      sourceRows.map((row, index) => {
        const context = contextById[row.id];
        const computedStatus = getDecisionStatus(decisions[row.id] ?? "open");
        const isDeferred = deferredRecords[row.id] === true;
        const queueStatus = isDeferred
          ? "uitgesteld"
          : decisions[row.id] && decisions[row.id] !== "open"
            ? computedStatus
            : context?.queueStatus ?? "nog-te-beoordelen";
        const risk = context?.risiconiveau ?? "laag";

        return {
          row,
          context: context
            ? {
                ...context,
                comments: [...context.comments, ...(manualComments[row.id] ?? [])],
              }
            : context,
          queueStatus,
          risk,
          snapshotVolgnummer: index + 1,
        };
      }),
    [contextById, decisions, deferredRecords, manualComments, sourceRows]
  );

  const visibleRows = useMemo(
    () =>
      queueRows
        .filter(({ row, queueStatus, risk }) => {
        const matchesSearch =
          row.titel.toLowerCase().includes(search.toLowerCase()) ||
          row.bron_id?.toLowerCase().includes(search.toLowerCase());
        const matchesRisk = activeRiskFilter === "alle" ? true : risk === activeRiskFilter;
        const matchesStatus =
          activeStatusFilter === "alle" ? true : queueStatus === activeStatusFilter;

        return matchesStatus && matchesSearch && matchesRisk;
        })
        .sort((left, right) => {
          const leftValue =
            sortKey === "omschrijving"
              ? left.row.titel
              : sortKey === "status"
                ? getQueueStatusLabel(left.queueStatus)
                : sortKey === "volgnummer"
                  ? left.snapshotVolgnummer
                  : sortKey === "code"
                    ? left.row.code ?? ""
                    : sortKey === "selectielijst"
                      ? left.row.selectielijst ?? ""
                      : sortKey === "grondslag"
                        ? left.row.grondslag ?? ""
                        : sortKey === "bewaartermijn"
                          ? left.row.bewaartermijn
                          : sortKey === "vernietigingsdatum"
                            ? left.row.vernietigingsdatum ?? ""
                            : sortKey === "opmerking"
                              ? left.context?.comments.length ?? 0
                              : sortKey === "aantalObjecten"
                                ? left.row.aantalObjecten
                                : sortKey === "aantalBetrokkenen"
                                  ? left.row.aantalBetrokkenen
                                  : sortKey === "periode"
                                    ? `${left.row.startdatum ?? ""} / ${left.row.einddatum ?? ""}`
                                    : sortKey === "stekker"
                                      ? left.row.bron_systeem ?? ""
                                      : left.row.bron_id ?? "";

          const rightValue =
            sortKey === "omschrijving"
              ? right.row.titel
              : sortKey === "status"
                ? getQueueStatusLabel(right.queueStatus)
                : sortKey === "volgnummer"
                  ? right.snapshotVolgnummer
                  : sortKey === "code"
                    ? right.row.code ?? ""
                    : sortKey === "selectielijst"
                      ? right.row.selectielijst ?? ""
                      : sortKey === "grondslag"
                        ? right.row.grondslag ?? ""
                        : sortKey === "bewaartermijn"
                          ? right.row.bewaartermijn
                          : sortKey === "vernietigingsdatum"
                            ? right.row.vernietigingsdatum ?? ""
                            : sortKey === "opmerking"
                              ? right.context?.comments.length ?? 0
                              : sortKey === "aantalObjecten"
                                ? right.row.aantalObjecten
                                : sortKey === "aantalBetrokkenen"
                                  ? right.row.aantalBetrokkenen
                                  : sortKey === "periode"
                                    ? `${right.row.startdatum ?? ""} / ${right.row.einddatum ?? ""}`
                                    : sortKey === "stekker"
                                      ? right.row.bron_systeem ?? ""
                                      : right.row.bron_id ?? "";

          const comparison =
            typeof leftValue === "number" && typeof rightValue === "number"
              ? leftValue - rightValue
              : collator.compare(String(leftValue), String(rightValue));

          return sortDirection === "asc" ? comparison : -comparison;
        }),
    [activeRiskFilter, activeStatusFilter, collator, queueRows, search, sortDirection, sortKey]
  );

  const activeSelectedId = useMemo(
    () =>
      visibleRows.some((item) => item.row.id === selectedId)
        ? selectedId
        : visibleRows[0]?.row.id ?? null,
    [selectedId, visibleRows]
  );

  const selectedIndex = useMemo(
    () => visibleRows.findIndex((item) => item.row.id === activeSelectedId),
    [activeSelectedId, visibleRows]
  );

  const selectedItem = useMemo(
    () => visibleRows.find((item) => item.row.id === activeSelectedId) ?? visibleRows[0],
    [activeSelectedId, visibleRows]
  );

  const previousRecord = selectedIndex > 0 ? visibleRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < visibleRows.length - 1
      ? visibleRows[selectedIndex + 1]
      : undefined;
  const isBulkMode = selectedTableIds.length > 1;
  const selectedBulkItems = useMemo(
    () =>
      isBulkMode
        ? visibleRows.filter((item) => selectedTableIds.includes(item.row.id))
        : [],
    [isBulkMode, selectedTableIds, visibleRows]
  );
  const actionTargetIds = isBulkMode
    ? selectedTableIds
    : selectedItem
      ? [selectedItem.row.id]
      : [];
  const bulkComments = useMemo(
    () =>
      selectedBulkItems.flatMap((item) =>
        (item.context?.comments ?? []).map((comment) => ({
          ...comment,
          role: `${comment.role} · ${item.row.titel}`,
        }))
      ),
    [selectedBulkItems]
  );
  const bulkStatusLabels = Array.from(
    new Set(selectedBulkItems.map((item) => getQueueStatusLabel(item.queueStatus)))
  );
  const bulkVolgnummers = selectedBulkItems
    .map((item) => item.snapshotVolgnummer)
    .filter((volgnummer) => volgnummer > 0);
  const bulkDetails = isBulkMode
    ? [
        { label: "Omschrijving", labelTitle: "Titel vernietigen informatieobjecten binnen de taak", value: `${selectedBulkItems.length} geselecteerde records`, stacked: true },
        { label: "Code", labelTitle: "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.", value: getSharedValue(selectedBulkItems.map((item) => item.row.code ?? "-"), "Meerdere codes") },
        { label: "Selectielijst", labelTitle: "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.", value: getSharedValue(selectedBulkItems.map((item) => item.row.selectielijst ?? "-"), "Meerdere selectielijsten") },
        { label: "Grondslag", labelTitle: "De categorie/grondslag uit de vignerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden", value: getSharedValue(selectedBulkItems.map((item) => item.row.grondslag ?? "-"), "Meerdere grondslagen") },
        { label: "Bewaartermijn", labelTitle: "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst", value: getSharedValue(selectedBulkItems.map((item) => `${item.row.bewaartermijn} jaar`), "Meerdere termijnen") },
        { label: "Vernietigingsdatum", labelTitle: "Jaar en maand waarin het dossier/informatieobject vernietigd moet worden. Format: jjjj-mm", value: selectedBulkItems.length > 0 ? `${selectedBulkItems[0]?.row.vernietigingsdatum ?? "-"} t/m ${selectedBulkItems[selectedBulkItems.length - 1]?.row.vernietigingsdatum ?? "-"}` : "-" },
        { label: "Periode", labelTitle: "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm", value: getSharedValue(selectedBulkItems.map((item) => `${item.row.startdatum ?? "-"} / ${item.row.einddatum ?? "-"}`), "Meerdere periodes") },
        { label: "Status", labelTitle: "Status van beoordeling: Akkoord, Retour, Uitgesloten, Uitgesteld", value: bulkStatusLabels.join(", ") },
        { label: "Aantal objecten", labelTitle: "Aantal objecten", value: selectedBulkItems.reduce((total, item) => total + item.row.aantalObjecten, 0).toLocaleString("nl-NL") },
        { label: "Aantal betrokkenen", labelTitle: "Aantal betrokkenen", value: selectedBulkItems.reduce((total, item) => total + item.row.aantalBetrokkenen, 0).toLocaleString("nl-NL") },
        { label: "Stekker", labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.", value: getSharedValue(selectedBulkItems.map((item) => item.row.bron_systeem ?? "-"), "Meerdere stekkers") },
        { label: "Bron-ID", labelTitle: "Identificatie van het informatieobject uit de stekker", value: `${selectedBulkItems.length} records` },
        { label: "ID", labelTitle: "Cockpit identicatienummer.", value: "Meerdere records" },
        { label: "Volgnummer", labelTitle: "Een nummer binnen de taak die voor vernietiging in aanmerking komen", value: bulkVolgnummers.length > 0 ? `${Math.min(...bulkVolgnummers)} t/m ${Math.max(...bulkVolgnummers)}` : "-" },
      ]
    : [];

  const selectedDecision = isBulkMode
    ? selectedActions[BULK_SELECTION_KEY] ?? "open"
    : selectedItem
      ? selectedActions[selectedItem.row.id] ?? "open"
      : "open";
  const selectedNote = isBulkMode
    ? notes[BULK_SELECTION_KEY] ?? ""
    : selectedItem
      ? notes[selectedItem.row.id] ?? ""
      : "";
  const completedCount = queueRows.filter((item) => {
    const decision = decisions[item.row.id] ?? "open";
    return decision !== "open";
  }).length;
  const allReviewed = queueRows.length > 0 && completedCount === queueRows.length;
  const hasRetour = queueRows.some((item) => item.queueStatus === "retour");
  const summaryStats = useMemo(
    () => ({
      teBeoordelen: queueRows.filter((item) => item.queueStatus === "nog-te-beoordelen").length,
      akkoord: queueRows.filter((item) => item.queueStatus === "afgerond").length,
      retour: queueRows.filter((item) => item.queueStatus === "retour").length,
      uitgesloten: queueRows.filter((item) => item.queueStatus === "conflict").length,
    }),
    [queueRows]
  );
  const reviewTableRows = useMemo(
    () =>
      visibleRows.map((item) => ({
        id: item.row.id,
        omschrijving: item.row.titel,
        queueStatus: item.queueStatus,
        volgnummer: item.snapshotVolgnummer,
        code: item.row.code ?? "-",
        selectielijst: item.row.selectielijst ?? "-",
        grondslag: item.row.grondslag ?? "-",
        bewaartermijn: `${item.row.bewaartermijn} jaar`,
        vernietigingsdatum: item.row.vernietigingsdatum ?? "-",
        opmerkingenCount: item.context?.comments.length ?? 0,
        aantalObjecten: item.row.aantalObjecten.toLocaleString("nl-NL"),
        aantalBetrokkenen: item.row.aantalBetrokkenen.toLocaleString("nl-NL"),
        periode: `${item.row.startdatum ?? "-"} / ${item.row.einddatum ?? "-"}`,
        stekker: item.row.bron_systeem ?? "-",
        bronId: item.row.bron_id ?? "-",
      })),
    [visibleRows]
  );

  const executeAction = async (action: ReviewAction) => {
    if (action === "open" || actionTargetIds.length === 0) {
      return;
    }

    setActionError(null);

    if (accessToken && id && apiRows) {
      const input = mapActionToApiInput(action, selectedNote);

      if (!input) {
        return;
      }

      setIsSavingAction(true);

      try {
        await Promise.all(
          actionTargetIds.map((kandidaatId) =>
            updateArchivarisAccordering(accessToken, id, kandidaatId, input)
          )
        );
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Archivaris-accordering opslaan is mislukt."
        );
        setIsSavingAction(false);
        return;
      }

      setIsSavingAction(false);
    }

    setDeferredRecords((current) => {
      const nextState = { ...current };

      actionTargetIds.forEach((id) => {
        delete nextState[id];
      });

      return nextState;
    });

    setDecisions((current) => {
      const nextState = { ...current };
      actionTargetIds.forEach((id) => {
        nextState[id] = action;
      });
      return nextState;
    });

    if (selectedNote.trim()) {
      setManualComments((current) => {
        const nextState = { ...current };
        actionTargetIds.forEach((id) => {
          nextState[id] = [
            ...(nextState[id] ?? []),
            {
              author: "Archivaris",
              role: "Archivaris",
              message: selectedNote.trim(),
              timestamp: new Date().toLocaleString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ];
        });
        return nextState;
      });

      setNotes((current) => {
        const nextState = { ...current };
        if (isBulkMode) {
          delete nextState[BULK_SELECTION_KEY];
        } else if (selectedItem) {
          nextState[selectedItem.row.id] = "";
        }
        return nextState;
      });
    }

    setSelectedActions((current) => {
      const nextState = { ...current };
      if (isBulkMode) {
        delete nextState[BULK_SELECTION_KEY];
      } else if (selectedItem) {
        delete nextState[selectedItem.row.id];
      }
      return nextState;
    });

    if (isBulkMode) {
      setSelectedTableIds([]);
      return;
    }

    if (nextRecord) {
      setSelectedId(nextRecord.row.id);
      return;
    }

    if (allReviewed) {
      setConfirmOpen(true);
    }
  };

  const executeSelectedAction = () => {
    void executeAction(selectedDecision);
  };

  const handleSubmitDecision = async () => {
    if (!accessToken || !id || !taakId) {
      setActionError("Archivaris-accordering afronden kan pas nadat de taak via de API is geladen.");
      setConfirmOpen(false);
      return;
    }

    setActionError(null);
    setIsSavingAction(true);

    try {
      const result = await submitArchivarisAccordering(accessToken, id);
      setConfirmOpen(false);

      if (result.status === "beoordeling") {
        navigate(`/taak/${taakId}/taakuitvoering/${id}/beoordeling`);
        return;
      }

      navigate(`/taak/${taakId}/taakuitvoering/${id}/uitvoering`);
    } catch (error) {
      setConfirmOpen(false);
      setActionError(
        error instanceof Error
          ? error.message
          : "Archivaris-accordering afronden is mislukt."
      );
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const inputType =
        target instanceof HTMLInputElement ? target.type.toLowerCase() : "";
      const isTyping =
        tagName === "TEXTAREA" ||
        (tagName === "INPUT" &&
          !["checkbox", "radio", "button", "submit"].includes(inputType)) ||
        target?.isContentEditable;

      if (isTyping || (!selectedItem && !isBulkMode)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "y") {
        event.preventDefault();
        void executeAction("akkoord");
      }

      if (key === "t") {
        event.preventDefault();
        void executeAction("retour");
      }

      if (key === "w" && selectedDecision !== "open") {
        event.preventDefault();
        void executeAction(selectedDecision);
      }

      if (key === "a" && previousRecord) {
        event.preventDefault();
        setSelectedId(previousRecord.row.id);
      }

      if (key === "d" && nextRecord) {
        event.preventDefault();
        setSelectedId(nextRecord.row.id);
      }
    });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <AppShellPortal slot="detail">
        {selectedItem ? (
          <RecordDetailsPanel
            record={isBulkMode ? { titel: `Selectie van ${selectedBulkItems.length} records` } : selectedItem.row}
            comments={isBulkMode ? bulkComments : selectedItem.context?.comments ?? []}
            currentIndex={isBulkMode ? 0 : selectedIndex >= 0 ? selectedIndex + 1 : 0}
            totalCount={isBulkMode ? 0 : visibleRows.length}
            onPrevious={isBulkMode ? undefined : previousRecord ? () => setSelectedId(previousRecord.row.id) : undefined}
            onNext={isBulkMode ? undefined : nextRecord ? () => setSelectedId(nextRecord.row.id) : undefined}
            heading={isBulkMode ? "Selectie" : "Record"}
            showTabs
            counterLabel={isBulkMode ? `${selectedBulkItems.length} geselecteerd` : undefined}
            detailsNotice={
              isBulkMode
                ? "Je hebt meerdere records geselecteerd. Hieronder staat een samenvatting van de selectie. Waar waarden verschillen, tonen we dit expliciet."
                : undefined
            }
            emptyCommentsMessage={
              isBulkMode
                ? "Er zijn nog geen opmerkingen binnen deze selectie."
                : undefined
            }
            details={isBulkMode ? bulkDetails : [
              {
                label: "Omschrijving",
                labelTitle: "Titel vernietigen informatieobjecten binnen de taak",
                value: selectedItem.row.titel,
                stacked: true,
              },
              {
                label: "Code",
                labelTitle:
                  "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.",
                value: selectedItem.row.code ?? "-",
              },
              {
                label: "Selectielijst",
                labelTitle:
                  "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.",
                value: selectedItem.row.selectielijst ?? "-",
              },
              {
                label: "Grondslag",
                labelTitle:
                  "De categorie/grondslag uit de vignerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden",
                value: selectedItem.row.grondslag ?? "-",
              },
              {
                label: "Bewaartermijn",
                labelTitle:
                  "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst",
                value: `${selectedItem.row.bewaartermijn} jaar`,
              },
              {
                label: "Vernietigingsdatum",
                labelTitle:
                  "Jaar en maand waarin het dossier/informatieobject vernietigd moet worden. Format: jjjj-mm",
                value: selectedItem.row.vernietigingsdatum ?? "-",
              },
              {
                label: "Periode",
                labelTitle:
                  "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm",
                value: `${selectedItem.row.startdatum ?? "-"} / ${selectedItem.row.einddatum ?? "-"}`,
              },
              {
                label: "Status",
                labelTitle:
                  "Status van beoordeling: Akkoord, Retour, Uitgesloten, Uitgesteld",
                value: getQueueStatusLabel(selectedItem.queueStatus),
                badgeClassName: getQueueStatusBadgeClasses(selectedItem.queueStatus),
              },
              {
                label: "Aantal objecten",
                labelTitle: "Aantal objecten",
                value: `${selectedItem.row.aantalObjecten}`,
              },
              {
                label: "Aantal betrokkenen",
                labelTitle: "Aantal betrokkenen",
                value: `${selectedItem.row.aantalBetrokkenen}`,
              },
              {
                label: "Stekker",
                labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.",
                value: selectedItem.row.bron_systeem ?? "-",
              },
              {
                label: "Bron-ID",
                labelTitle: "Identificatie van het informatieobject uit de stekker",
                value: selectedItem.row.bron_id ?? "-",
              },
              {
                label: "ID",
                labelTitle: "Cockpit identicatienummer.",
                value: selectedItem.row.id,
              },
              {
                label: "Volgnummer",
                labelTitle:
                  "Een nummer binnen de taak die voor vernietiging in aanmerking komen",
                value: `${selectedItem.snapshotVolgnummer}`,
              },
            ]}
          />
        ) : null}
      </AppShellPortal>

      <AppShellPortal slot="action">
        <ActionPanel
          embedded
          title="Actie"
          titleClassName="text-sm"
          hideHeaderBorder
          hideFooterBorder
          bodyPaddingYClass="py-0"
          footer={
            selectedItem ? (
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label={isSavingAction ? "Opslaan..." : "Actie uitvoeren"}
                  variant="primary"
                  disabled={!selectedItem || selectedDecision === "open" || isSavingAction}
                  onClick={executeSelectedAction}
                />
                <ActionPanelButton
                  label={hasRetour ? "Retour naar recordmanager" : "Vrijgeven"}
                  variant="secondary"
                  disabled={!allReviewed || isSavingAction}
                  onClick={() => setConfirmOpen(true)}
                />
              </ActionPanelButtonGroup>
            ) : null
          }
        >
          {!selectedItem ? (
            <ActionPanelEmptyState
              title="Kies eerst een record"
              description="Na selectie tonen we hier de aanbevolen vervolgstap, notities en snelle acties."
            />
          ) : (
            <>
              <ActionPanelSection title="">
                {isBulkMode ? (
                  <p className="mb-3 text-sm leading-5 text-slate-500">
                    Je voert deze actie uit op {selectedTableIds.length} geselecteerde records.
                  </p>
                ) : null}
                <div className="space-y-2">
                  {reviewActions.map((item) => (
                    <ActionPanelChoice
                      key={item.id}
                      title={item.title}
                      icon={item.icon}
                      tone={item.tone}
                      density="compact"
                      selected={selectedDecision === item.id}
                      onClick={() =>
                        setSelectedActions((current) => ({
                          ...current,
                          [isBulkMode ? BULK_SELECTION_KEY : selectedItem.row.id]: item.id,
                        }))
                      }
                    />
                  ))}
                </div>
              </ActionPanelSection>

              <div>
                <ActionPanelTextarea
                  label={isBulkMode ? "Opmerking voor selectie" : "Opmerking"}
                  placeholder={
                    isBulkMode
                      ? "Voeg context toe die bij alle geselecteerde records wordt geplaatst..."
                      : "Voeg context toe voor de gekozen of voorgenomen actie..."
                  }
                  value={selectedNote}
                  onChange={(value) =>
                    setNotes((current) => ({
                      ...current,
                      [isBulkMode ? BULK_SELECTION_KEY : selectedItem.row.id]: value,
                    }))
                  }
                />
              </div>

              {actionError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700">
                  {actionError}
                </p>
              ) : null}
            </>
          )}
        </ActionPanel>
      </AppShellPortal>

      <AppShellPortal slot="shortcut">
        <ShortcutPane
          shortcuts={[
            { keyLabel: "A", label: "Vorige" },
            { keyLabel: "D", label: "Volgende" },
            { keyLabel: "W", label: "Actie uitvoeren" },
            { keyLabel: "T", label: "Retour" },
            { keyLabel: "Y", label: "Akkoord" },
          ]}
        />
      </AppShellPortal>

      <ReviewRecordPanel
        record={selectedItem?.row}
        context={selectedItem?.context}
        currentIndex={selectedIndex >= 0 ? selectedIndex + 1 : 0}
        totalCount={visibleRows.length}
        activeStep="ACCORDERING_ARCH"
        showRecordSections={false}
        summaryStats={summaryStats}
        reviewTableRows={reviewTableRows}
        selectedTableIds={selectedTableIds}
        onSelectedTableIdsChange={setSelectedTableIds}
        activeRecordId={selectedItem?.row.id ?? null}
        onActiveRecordChange={setSelectedId}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key, direction) => {
          setSortKey(key);
          setSortDirection(direction);
        }}
        enableCrossPageBulkSelection
        onPrevious={previousRecord ? () => setSelectedId(previousRecord.row.id) : undefined}
        onNext={nextRecord ? () => setSelectedId(nextRecord.row.id) : undefined}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={hasRetour ? "Retour naar recordmanager?" : "Vrijgeven?"}
        description={
          hasRetour
            ? "Je rondt de archivaris-accordering af en zet de lijst terug naar de recordmanager voor herbeoordeling."
            : "Je bevestigt hiermee dat de archivistische accordering gereed is en dat de lijst vrijgegeven wordt voor vernietigingsopdracht."
        }
        confirmLabel={hasRetour ? "Ja, retour sturen" : "Ja, vrijgeven"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          void handleSubmitDecision();
        }}
      />
    </>
  );
}
