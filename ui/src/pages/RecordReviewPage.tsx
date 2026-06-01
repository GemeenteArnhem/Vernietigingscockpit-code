import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCheck,
  Clock3,
  FileX2,
  SendToBack,
} from "lucide-react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
  ActionPanelShortcuts,
  ActionPanelTextarea,
} from "../components/ActionPanel";
import ConfirmDialog from "../components/ConfirmDialog";
import RecordPaneBar, {
  type RecordPaneBarFilter,
  type RecordPaneBarFilterSection,
  type RecordPaneBarItem,
  type RecordPaneBarTab,
  type RecordPaneBarTone,
} from "../components/record-pane/RecordPaneBar";
import ReviewRecordPanel from "../features/task-execution/review/components/ReviewRecordPanel";
import { initialReviewDecisions, reviewRecordContexts } from "../shared/mocks/reviewPage";
import { reviewRows } from "../shared/mocks/reviewRows";
import type {
  ReviewComment,
  ReviewDecision,
  ReviewQueueStatus,
  ReviewRiskLevel,
} from "../shared/types/review";

type ReviewStatusFilter =
  | "alle"
  | "nog-te-beoordelen"
  | "retour"
  | "conflict"
  | "afgerond"
  | "uitgesteld";
type ReviewRiskFilter = "alle" | ReviewRiskLevel;
type ReviewAction = ReviewDecision | "uitstellen";

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

function getQueueStatusTone(status: ReviewQueueStatus): RecordPaneBarTone {
  switch (status) {
    case "afgerond":
      return "success";
    case "conflict":
      return "danger";
    case "retour":
      return "warning";
    default:
      return "info";
  }
}

function getRiskLabel(risk: ReviewRiskLevel) {
  switch (risk) {
    case "hoog":
      return "Hoog risico";
    case "middel":
      return "Middel risico";
    default:
      return "Laag risico";
  }
}

function getRiskShortLabel(risk: ReviewRiskLevel) {
  switch (risk) {
    case "hoog":
      return "Hoog";
    case "middel":
      return "Middel";
    default:
      return "Laag";
  }
}

function getStatusFilterLabel(filter: ReviewStatusFilter) {
  switch (filter) {
    case "alle":
      return "Alle";
    case "retour":
      return "Retour";
    case "conflict":
      return "Uitgesloten";
    case "afgerond":
      return "Beoordeeld";
    case "uitgesteld":
      return "Uitgesteld";
    default:
      return "Open";
  }
}

const reviewActions = [
  {
    id: "akkoord" as const,
    title: "Akkoord",
    description: "Record markeren als inhoudelijk beoordeeld.",
    icon: <CheckCheck size={18} />,
    tone: "success" as const,
  },
  {
    id: "uitsluiten" as const,
    title: "Uitsluiten",
    description: "Record buiten de vernietigingslijst plaatsen.",
    icon: <FileX2 size={18} />,
    tone: "danger" as const,
  },
  {
    id: "retour" as const,
    title: "Retour sturen",
    description: "Terugzetten voor aanvullende controle of toelichting.",
    icon: <SendToBack size={18} />,
    tone: "warning" as const,
  },
  {
    id: "uitstellen" as const,
    title: "Uitstellen",
    description: "Later opnieuw beoordelen binnen deze taak.",
    icon: <Clock3 size={18} />,
    tone: "neutral" as const,
  },
];

export default function RecordReviewPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();

  const [search, setSearch] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] =
    useState<ReviewStatusFilter>("alle");
  const [activeRiskFilter, setActiveRiskFilter] = useState<ReviewRiskFilter>("alle");
  const [selectedId, setSelectedId] = useState<string | null>(reviewRows[0]?.id ?? null);
  const [decisions, setDecisions] =
    useState<Record<string, ReviewDecision>>(initialReviewDecisions);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [deferredRecords, setDeferredRecords] = useState<Record<string, boolean>>({});
  const [selectedActions, setSelectedActions] = useState<Record<string, ReviewAction>>({});
  const [manualComments, setManualComments] = useState<Record<string, ReviewComment[]>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const contextById = useMemo(
    () => Object.fromEntries(reviewRecordContexts.map((context) => [context.recordId, context])),
    []
  );

  const queueRows = useMemo(
    () =>
      reviewRows.map((row) => {
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
        };
      }),
    [contextById, decisions, deferredRecords, manualComments]
  );

  const filters = useMemo<RecordPaneBarFilter[]>(
    () => [],
    []
  );

  const tabs = useMemo<RecordPaneBarTab[]>(() => [], []);

  const filterSections = useMemo<RecordPaneBarFilterSection[]>(
    () => [
      {
        key: "status",
        label: "Status",
        activeKey: activeStatusFilter,
        onChange: (key) => setActiveStatusFilter(key as ReviewStatusFilter),
        options: [
          {
            key: "alle",
            label: "Alle",
            count: queueRows.length,
          },
          {
            key: "nog-te-beoordelen",
            label: "Open",
            count: queueRows.filter((item) => item.queueStatus === "nog-te-beoordelen").length,
          },
          {
            key: "retour",
            label: "Retour",
            count: queueRows.filter((item) => item.queueStatus === "retour").length,
          },
          {
            key: "conflict",
            label: "Uitgesloten",
            count: queueRows.filter((item) => item.queueStatus === "conflict").length,
          },
          {
            key: "afgerond",
            label: "Beoordeeld",
            count: queueRows.filter((item) => item.queueStatus === "afgerond").length,
          },
          {
            key: "uitgesteld",
            label: "Uitgesteld",
            count: queueRows.filter((item) => item.queueStatus === "uitgesteld").length,
          },
        ],
      },
      {
        key: "risico",
        label: "Risico",
        activeKey: activeRiskFilter,
        onChange: (key) => setActiveRiskFilter(key as ReviewRiskFilter),
        options: [
          {
            key: "alle",
            label: "Alle",
            count: queueRows.length,
          },
          {
            key: "laag",
            label: "Laag risico",
            count: queueRows.filter((item) => item.risk === "laag").length,
          },
          {
            key: "middel",
            label: "Midden risico",
            count: queueRows.filter((item) => item.risk === "middel").length,
          },
          {
            key: "hoog",
            label: "Hoog risico",
            count: queueRows.filter((item) => item.risk === "hoog").length,
          },
        ],
      },
    ],
    [activeRiskFilter, activeStatusFilter, queueRows]
  );

  const visibleRows = useMemo(
    () =>
      queueRows.filter(({ row, queueStatus, risk }) => {
        const matchesSearch =
          row.titel.toLowerCase().includes(search.toLowerCase()) ||
          row.bron_id?.toLowerCase().includes(search.toLowerCase());
        const matchesRisk = activeRiskFilter === "alle" ? true : risk === activeRiskFilter;
        const matchesStatus =
          activeStatusFilter === "alle" ? true : queueStatus === activeStatusFilter;

        return matchesStatus && matchesSearch && matchesRisk;
      }),
    [activeRiskFilter, activeStatusFilter, queueRows, search]
  );

  useEffect(() => {
    if (!visibleRows.some((item) => item.row.id === selectedId)) {
      setSelectedId(visibleRows[0]?.row.id ?? null);
    }
  }, [selectedId, visibleRows]);

  const selectedIndex = useMemo(
    () => visibleRows.findIndex((item) => item.row.id === selectedId),
    [selectedId, visibleRows]
  );

  const selectedItem = useMemo(
    () => visibleRows.find((item) => item.row.id === selectedId) ?? visibleRows[0],
    [selectedId, visibleRows]
  );

  const previousRecord = selectedIndex > 0 ? visibleRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < visibleRows.length - 1
      ? visibleRows[selectedIndex + 1]
      : undefined;

  const paneItems = useMemo<RecordPaneBarItem[]>(
    () =>
      visibleRows.map(({ row, queueStatus, risk }) => ({
        id: row.id,
        title: row.titel,
        stepLabel: getRiskShortLabel(risk),
        stepTone: getQueueStatusTone(queueStatus),
        status:
          queueStatus === "afgerond"
            ? "Beoordeeld"
            : queueStatus === "conflict"
              ? "Uitgesloten"
            : queueStatus === "retour"
                ? "Retour"
              : queueStatus === "uitgesteld"
                ? "Uitgesteld"
                : "Open",
      })),
    [visibleRows]
  );

  const committedDecision = selectedItem ? decisions[selectedItem.row.id] ?? "open" : "open";
  const selectedDecision = selectedItem
    ? selectedActions[selectedItem.row.id] ?? committedDecision
    : "open";
  const selectedNote = selectedItem ? notes[selectedItem.row.id] ?? "" : "";
  const completedCount = queueRows.filter((item) => {
    const decision = decisions[item.row.id] ?? "open";
    return decision !== "open";
  }).length;
  const allReviewed = queueRows.length > 0 && completedCount === queueRows.length;

  const executeAction = (action: ReviewAction) => {
    if (!selectedItem || action === "open") {
      return;
    }

    setDeferredRecords((current) => {
      const nextState = { ...current };

      if (action === "uitstellen") {
        nextState[selectedItem.row.id] = true;
      } else {
        delete nextState[selectedItem.row.id];
      }

      return nextState;
    });

    if (action !== "uitstellen") {
      setDecisions((current) => ({
        ...current,
        [selectedItem.row.id]: action,
      }));
    }

    if (selectedNote.trim()) {
      setManualComments((current) => ({
        ...current,
        [selectedItem.row.id]: [
          ...(current[selectedItem.row.id] ?? []),
          {
            author: "Proceseigenaar",
            role: "Proceseigenaar",
            message: selectedNote.trim(),
            timestamp: "1 juni 2026, 14:30",
          },
        ],
      }));

      setNotes((current) => ({
        ...current,
        [selectedItem.row.id]: "",
      }));
    }

    setSelectedActions((current) => {
      const nextState = { ...current };
      delete nextState[selectedItem.row.id];
      return nextState;
    });

    if (nextRecord) {
      setSelectedId(nextRecord.row.id);
      return;
    }

    if (allReviewed) {
      setConfirmOpen(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isTyping =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTyping || !selectedItem) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "y") {
        event.preventDefault();
        executeAction("akkoord");
      }

      if (key === "u") {
        event.preventDefault();
        executeAction("uitsluiten");
      }

      if (key === "t") {
        event.preventDefault();
        executeAction("retour");
      }

      if (key === "w" && selectedDecision !== "open") {
        event.preventDefault();
        executeSelectedAction();
      }

      if (key === "a" && previousRecord) {
        event.preventDefault();
        setSelectedId(previousRecord.row.id);
      }

      if (key === "d" && nextRecord) {
        event.preventDefault();
        setSelectedId(nextRecord.row.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allReviewed, nextRecord, previousRecord, selectedItem, selectedNote]);

  const executeSelectedAction = () => {
    executeAction(selectedDecision);
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <RecordPaneBar
        title="Records"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Zoek record..."
        tabs={tabs}
        activeTab=""
        onTabChange={() => undefined}
        filters={filters}
        activeFilter=""
        onFilterChange={() => undefined}
        filterSections={filterSections}
        items={paneItems}
        selectedId={selectedItem?.row.id ?? null}
        onSelect={setSelectedId}
        emptyMessage={`Geen records gevonden voor ${getStatusFilterLabel(activeStatusFilter).toLowerCase()}${activeRiskFilter !== "alle" ? ` met ${getRiskLabel(activeRiskFilter).toLowerCase()}` : ""}.`}
        density="compact"
        showItemMeta={false}
      />

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <ReviewRecordPanel
          record={selectedItem?.row}
          context={selectedItem?.context}
          queueStatus={selectedItem?.queueStatus}
          currentIndex={selectedIndex >= 0 ? selectedIndex + 1 : 0}
          totalCount={visibleRows.length}
          onPrevious={previousRecord ? () => setSelectedId(previousRecord.row.id) : undefined}
          onNext={nextRecord ? () => setSelectedId(nextRecord.row.id) : undefined}
        />

        <ActionPanel
          title="Acties"
          subtitle="Kies de vervolgstap voor het geselecteerde record en voeg een toelichting toe."
          footer={
            selectedItem ? (
            <div className="space-y-2.5">
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Actie uitvoeren"
                  variant="primary"
                  disabled={!selectedItem || selectedDecision === "open"}
                  onClick={executeSelectedAction}
                />
                <ActionPanelButton
                  label="Door naar accordering"
                  variant="secondary"
                  onClick={() => setConfirmOpen(true)}
                />
              </ActionPanelButtonGroup>

              <ActionPanelShortcuts
                shortcuts={[
                  { keyLabel: "A", label: "Vorige" },
                  { keyLabel: "D", label: "Volgende" },
                  { keyLabel: "W", label: "Actie uitvoeren" },
                  { keyLabel: "T", label: "Retour" },
                  { keyLabel: "Y", label: "Akkoord" },
                  { keyLabel: "U", label: "Uitsluiten" },
                ]}
              />
            </div>
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
              <ActionPanelSection
                title="Kies een actie"
                description="Selecteer eerst de gewenste uitkomst voor dit record."
              >
                <div className="space-y-2">
                  {reviewActions.map((item) => (
                    <ActionPanelChoice
                      key={item.id}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                      tone={item.tone}
                      density="compact"
                      selected={selectedDecision === item.id}
                      onClick={() =>
                        setSelectedActions((current) => ({
                          ...current,
                          [selectedItem.row.id]: item.id,
                        }))
                      }
                    />
                  ))}
                </div>
              </ActionPanelSection>

              <div>
                <ActionPanelTextarea
                  label="Toelichting"
                  placeholder="Voeg context toe voor de gekozen of voorgenomen actie..."
                  value={selectedNote}
                  onChange={(value) =>
                    setNotes((current) => ({
                      ...current,
                      [selectedItem.row.id]: value,
                    }))
                  }
                />
              </div>
            </>
          )}
        </ActionPanel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Door naar accordering?"
        description="Je rondt de beoordelingsstap af en zet de lijst door naar de proceseigenaar voor accordering."
        confirmLabel="Ja, door naar accordering"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          navigate(`/taak/${taakId}/taakuitvoering/${id}/accordering/proceseigenaar`);
        }}
      />
    </div>
  );
}
