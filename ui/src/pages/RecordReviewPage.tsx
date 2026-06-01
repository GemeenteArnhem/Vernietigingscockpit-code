import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftRight,
  CheckCheck,
  FileX2,
  SendToBack,
} from "lucide-react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelSection,
  ActionPanelShortcuts,
  ActionPanelSummary,
  ActionPanelTextarea,
} from "../components/ActionPanel";
import ConfirmDialog from "../components/ConfirmDialog";
import RecordPaneBar, {
  type RecordPaneBarFilter,
  type RecordPaneBarItem,
  type RecordPaneBarTab,
  type RecordPaneBarTone,
} from "../components/record-pane/RecordPaneBar";
import ReviewRecordPanel from "../features/task-execution/review/components/ReviewRecordPanel";
import { initialReviewDecisions, reviewRecordContexts, reviewTaskContext } from "../shared/mocks/reviewPage";
import { reviewRows } from "../shared/mocks/reviewRows";
import type { VernietigingsObject } from "../shared/types/destruction";
import type {
  ReviewDecision,
  ReviewQueueStatus,
  ReviewRiskLevel,
} from "../shared/types/review";

type ReviewFilter = "alle" | "laag-risico" | "afwijkingen" | "retour";

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
      return "Beoordeeld";
    case "conflict":
      return "Uitgesloten";
    case "retour":
      return "Retour";
    default:
      return "Open";
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

function getFilterLabel(filter: ReviewFilter) {
  switch (filter) {
    case "laag-risico":
      return "Laag risico";
    case "afwijkingen":
      return "Afwijkingen";
    case "retour":
      return "Retour";
    default:
      return "Alle";
  }
}

function matchesFilter(
  record: VernietigingsObject,
  risk: ReviewRiskLevel,
  queueStatus: ReviewQueueStatus,
  filter: ReviewFilter
) {
  if (filter === "laag-risico") {
    return risk === "laag";
  }

  if (filter === "afwijkingen") {
    return queueStatus === "conflict" || record.uitgesloten;
  }

  if (filter === "retour") {
    return queueStatus === "retour";
  }

  return true;
}

function getDecisionCopy(decision: ReviewDecision) {
  switch (decision) {
    case "akkoord":
      return {
        title: "Akkoord",
        description: "Dit record kan worden doorgezet naar accordering.",
      };
    case "uitsluiten":
      return {
        title: "Uitsluiten",
        description: "Dit record mag niet vernietigd worden.",
      };
    case "retour":
      return {
        title: "Retour sturen",
        description: "Stuur terug voor aanvulling of extra informatie.",
      };
    default:
      return {
        title: "Nog geen keuze",
        description: "Kies eerst een beoordeling voor dit record.",
      };
  }
}

export default function RecordReviewPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ReviewQueueStatus>("nog-te-beoordelen");
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("alle");
  const [selectedId, setSelectedId] = useState<string | null>(reviewRows[0]?.id ?? null);
  const [decisions, setDecisions] =
    useState<Record<string, ReviewDecision>>(initialReviewDecisions);
  const [notes, setNotes] = useState<Record<string, string>>({});
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
        const queueStatus =
          decisions[row.id] && decisions[row.id] !== "open"
            ? computedStatus
            : context?.queueStatus ?? "nog-te-beoordelen";
        const risk = context?.risiconiveau ?? "laag";

        return {
          row,
          context,
          queueStatus,
          risk,
        };
      }),
    [contextById, decisions]
  );

  const tabs = useMemo<RecordPaneBarTab[]>(
    () => [
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
    ],
    [queueRows]
  );

  const filters = useMemo<RecordPaneBarFilter[]>(
    () => [
      { key: "alle", label: "Alle" },
      { key: "laag-risico", label: "Laag risico" },
      { key: "afwijkingen", label: "Afwijkingen" },
      { key: "retour", label: "Retour" },
    ],
    []
  );

  const visibleRows = useMemo(
    () =>
      queueRows.filter(({ row, queueStatus, risk }) => {
        const matchesTab = queueStatus === activeTab;
        const matchesSearch =
          row.titel.toLowerCase().includes(search.toLowerCase()) ||
          row.bron_id?.toLowerCase().includes(search.toLowerCase());
        const filterMatch = matchesFilter(row, risk, queueStatus, activeFilter);

        return matchesTab && matchesSearch && filterMatch;
      }),
    [activeFilter, activeTab, queueRows, search]
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
        stepLabel:
          queueStatus === "nog-te-beoordelen"
            ? getRiskLabel(risk)
            : `${getRiskLabel(risk)} / ${getQueueStatusLabel(queueStatus)}`,
        stepTone: getQueueStatusTone(queueStatus),
        status:
          queueStatus === "afgerond"
            ? "Beoordeeld"
            : queueStatus === "conflict"
              ? "Uitgesloten"
              : queueStatus === "retour"
                ? "WAARSCHUWING"
                : "Open",
      })),
    [visibleRows]
  );

  const selectedDecision = selectedItem ? decisions[selectedItem.row.id] ?? "open" : "open";
  const selectedNote = selectedItem ? notes[selectedItem.row.id] ?? "" : "";
  const completedCount = queueRows.filter((item) => {
    const decision = decisions[item.row.id] ?? "open";
    return decision !== "open";
  }).length;
  const allReviewed = queueRows.length > 0 && completedCount === queueRows.length;

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

      if (key === "a") {
        event.preventDefault();
        setDecisions((current) => ({ ...current, [selectedItem.row.id]: "akkoord" }));
      }

      if (key === "u") {
        event.preventDefault();
        setDecisions((current) => ({ ...current, [selectedItem.row.id]: "uitsluiten" }));
      }

      if (key === "r") {
        event.preventDefault();
        setDecisions((current) => ({ ...current, [selectedItem.row.id]: "retour" }));
      }

      if (key === "n" && nextRecord) {
        event.preventDefault();
        setSelectedId(nextRecord.row.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextRecord, selectedItem]);

  const saveAndGoNext = () => {
    if (!selectedItem || selectedDecision === "open") {
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

  return (
    <div className="flex flex-1 min-h-0">
      <RecordPaneBar
        title="Records"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Zoek record..."
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as ReviewQueueStatus)}
        filters={filters}
        activeFilter={activeFilter}
        onFilterChange={(key) => setActiveFilter(key as ReviewFilter)}
        items={paneItems}
        selectedId={selectedItem?.row.id ?? null}
        onSelect={setSelectedId}
        emptyMessage={`Geen records gevonden voor ${getQueueStatusLabel(activeTab).toLowerCase()} met filter ${getFilterLabel(activeFilter).toLowerCase()}.`}
        widthClassName="w-[440px]"
        density="compact"
        showItemMeta={false}
      />

      <div className="flex min-w-0 flex-1">
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
          title="Jouw beslissing"
          subtitle="Leg per record een duidelijke keuze vast en werk daarna door naar het volgende record."
          footer={
            <div className="space-y-2.5">
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Opslaan en volgende"
                  variant="primary"
                  hotkey="N"
                  disabled={!selectedItem || selectedDecision === "open"}
                  onClick={saveAndGoNext}
                />
                <ActionPanelButton
                  label="Opslaan en later beoordelen"
                  variant="secondary"
                  onClick={() => undefined}
                  disabled={!selectedItem || selectedDecision === "open"}
                />
                <ActionPanelButton
                  label="Door naar accordering"
                  variant="ghost"
                  disabled={!allReviewed}
                  onClick={() => setConfirmOpen(true)}
                />
              </ActionPanelButtonGroup>

              <ActionPanelShortcuts
                shortcuts={[
                  { keyLabel: "A", label: "Akkoord" },
                  { keyLabel: "U", label: "Uitsluiten" },
                  { keyLabel: "R", label: "Retour" },
                  { keyLabel: "N", label: "Volgende" },
                ]}
              />
            </div>
          }
        >
          <ActionPanelSummary
            eyebrow="Taak"
            title={reviewTaskContext.procesnaam}
            items={[
              {
                label: "Nog te beoordelen",
                value: `${queueRows.filter((item) => item.queueStatus === "nog-te-beoordelen").length}`,
              },
              {
                label: "Afgerond",
                value: `${queueRows.filter((item) => item.queueStatus === "afgerond").length}`,
              },
              {
                label: "Recordmanager",
                value: reviewTaskContext.recordmanager,
              },
              {
                label: "Proceseigenaar",
                value: reviewTaskContext.proceseigenaar,
              },
            ]}
          />

          <ActionPanelSection
            title="Kies een beslissing"
            description="Houd de keuze sober en eenduidig. De context staat links."
          >
            <div className="space-y-3">
              <ActionPanelChoice
                title="Akkoord"
                description="Dit record kan vernietigd worden en door naar accordering."
                icon={<CheckCheck size={18} />}
                tone="success"
                selected={selectedDecision === "akkoord"}
                onClick={() =>
                  selectedItem &&
                  setDecisions((current) => ({
                    ...current,
                    [selectedItem.row.id]: "akkoord",
                  }))
                }
              />
              <ActionPanelChoice
                title="Uitsluiten"
                description="Dit record moet uit de vernietigingslijst gehaald worden."
                icon={<FileX2 size={18} />}
                tone="danger"
                selected={selectedDecision === "uitsluiten"}
                onClick={() =>
                  selectedItem &&
                  setDecisions((current) => ({
                    ...current,
                    [selectedItem.row.id]: "uitsluiten",
                  }))
                }
              />
              <ActionPanelChoice
                title="Retour sturen"
                description="Stuur terug voor extra informatie of correctie."
                icon={<SendToBack size={18} />}
                tone="warning"
                selected={selectedDecision === "retour"}
                onClick={() =>
                  selectedItem &&
                  setDecisions((current) => ({
                    ...current,
                    [selectedItem.row.id]: "retour",
                  }))
                }
              />
            </div>
          </ActionPanelSection>

          <ActionPanelSection
            title="Opmerking"
            description={getDecisionCopy(selectedDecision).description}
          >
            <ActionPanelTextarea
              label={getDecisionCopy(selectedDecision).title}
              placeholder="Voeg een korte toelichting toe voor deze beoordeling..."
              value={selectedNote}
              onChange={(value) => {
                if (!selectedItem) {
                  return;
                }

                setNotes((current) => ({
                  ...current,
                  [selectedItem.row.id]: value,
                }));
              }}
            />
          </ActionPanelSection>

          <ActionPanelSection
            title="Voortgang"
            description="Je kunt pas door naar accordering als alle records een keuze hebben."
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {completedCount} van {queueRows.length} beoordeeld
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Openstaand: {queueRows.length - completedCount} records
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm shadow-slate-200/50">
                  <ArrowLeftRight size={18} />
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${queueRows.length === 0 ? 0 : (completedCount / queueRows.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </ActionPanelSection>
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
