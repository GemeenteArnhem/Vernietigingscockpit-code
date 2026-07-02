import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  FolderOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
} from "../components/ActionPanel";
import ContentPanel from "../components/ContentPanel";
import DashboardRecordPanel from "../components/dashboard/DashboardRecordPanel";
import type {
  RecordPaneBarFilter,
  RecordPaneBarItem,
  RecordPaneBarTab,
} from "../components/record-pane/RecordPaneBar";
import ShortcutPane from "../components/ShortcutPane";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  dashboardSummaryStats,
  dashboardTaskMetaItems,
  dashboardTaskRows,
} from "../shared/mocks/dashboardPage";
import { dashboardTaskExecutionPanelById } from "../shared/mocks/dashboardTaskExecutionPanel";
import type { DashboardTaskRecord } from "../shared/types/dashboard";

type WorkloadScope = "mijn" | "alle";
type WorkloadFilter = "alle" | "actie" | "lopend" | "gepland";

type DashboardDecisionId =
  | "openen"
  | "herinneren"
  | "starten"
  | "herplannen";

type DashboardDecision = {
  id: DashboardDecisionId;
  title: string;
  description?: string;
  icon: ReactNode;
  tone: "primary" | "success" | "warning";
};

function getReminderLabel(
  record: DashboardTaskRecord
) {
  const step = record.stap.toLowerCase();

  if (
    step.includes("archivaris")
  ) {
    return "Herinner archivaris";
  }

  if (
    step.includes("proceseigenaar") ||
    step.includes("po")
  ) {
    return "Herinner proceseigenaar";
  }

  return "Stuur herinnering";
}

function getDashboardDecisions(
  record: DashboardTaskRecord
): DashboardDecision[] {
  if (record.status === "VERTRAAGD") {
    return [
      {
        id: "openen",
        title: "Open taak",
        icon: <FolderOpen size={18} />,
        tone: "primary",
      },
      {
        id: "herinneren",
        title: getReminderLabel(
          record
        ),
        icon: <CheckCircle2 size={18} />,
        tone: "success",
      },
    ];
  }

  if (record.status === "GEPLAND") {
    return [
      {
        id: "starten",
        title: "Taak starten",
        icon: <FolderOpen size={18} />,
        tone: "primary",
      },
      {
        id: "herplannen",
        title: "Start herplannen",
        icon: <Clock3 size={18} />,
        tone: "warning",
      },
    ];
  }

  return [
    {
      id: "openen",
      title: "Open taak",
      icon: <FolderOpen size={18} />,
      tone: "primary",
    },
  ];
}

function getDashboardStatusLabel(
  status: DashboardTaskRecord["status"]
) {
  switch (status) {
    case "LOPEND":
      return "Lopend";
    case "GEPLAND":
      return "Gepland";
    default:
      return "Vertraagd";
  }
}

function getDashboardStatusBadgeClasses(
  status: DashboardTaskRecord["status"]
) {
  switch (status) {
    case "LOPEND":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "GEPLAND":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [search, setSearch] =
    useState("");

  const [scope, setScope] =
    useState<WorkloadScope>("mijn");

  const [filter, setFilter] =
    useState<WorkloadFilter>("alle");

  const [selectedId, setSelectedId] =
    useState<string | null>(
      dashboardTaskRows[0]?.id ?? null
    );

  const [panelState, setPanelState] =
    useState<{
      recordId: string | null;
      decision: DashboardDecisionId;
    }>({
      recordId: dashboardTaskRows[0]?.id ?? null,
      decision: "openen",
    });

  const tabs = useMemo<
    RecordPaneBarTab[]
  >(
    () => [
      {
        key: "mijn",
        label: "Mijn werkvoorraad",
        count: dashboardTaskRows.filter(
          (row) =>
            row.eigenaar === "mijn"
        ).length,
      },
      {
        key: "alle",
        label: "Alle",
        count: dashboardTaskRows.length,
      },
    ],
    []
  );

  const filters = useMemo<
    RecordPaneBarFilter[]
  >(
    () => [
      {
        key: "alle",
        label: "Alle",
      },
      {
        key: "actie",
        label: "Actie",
      },
      {
        key: "lopend",
        label: "Lopend",
      },
      {
        key: "gepland",
        label: "Gepland",
      },
    ],
    []
  );

  const visibleRows = useMemo(() => {
    return dashboardTaskRows.filter((row) => {
      const matchesScope =
        scope === "alle" ||
        row.eigenaar === "mijn";

      const matchesFilter =
        filter === "alle" ||
        (filter === "actie" &&
          row.status ===
            "VERTRAAGD") ||
        (filter === "lopend" &&
          row.status === "LOPEND") ||
        (filter === "gepland" &&
          row.status ===
            "GEPLAND");

      const query =
        search.toLowerCase();
      const matchesSearch =
        row.naam
          .toLowerCase()
          .includes(query) ||
        row.stap
          .toLowerCase()
          .includes(query) ||
        row.startdatum
          .toLowerCase()
          .includes(query);

      return (
        matchesScope &&
        matchesFilter &&
        matchesSearch
      );
    });
  }, [filter, scope, search]);

  const paneItems = useMemo<
    RecordPaneBarItem[]
  >(
    () =>
      visibleRows.map((row) => ({
        id: row.id,
        title: row.naam,
        stepLabel: row.stap,
        stepTone:
          row.status ===
          "VERTRAAGD"
            ? "danger"
            : row.status ===
                "LOPEND"
              ? "info"
              : "warning",
        status: row.status,
      })),
    [visibleRows]
  );

  const effectiveSelectedId =
    paneItems.some(
      (item) => item.id === selectedId
    )
      ? selectedId
      : paneItems[0]?.id ?? null;

  const selectedRecord = useMemo(() => {
    return visibleRows.find(
      (r) =>
        r.id ===
        effectiveSelectedId
    );
  }, [
    effectiveSelectedId,
    visibleRows,
  ]);

  const decisions = useMemo(
    () =>
      selectedRecord
        ? getDashboardDecisions(
            selectedRecord
        )
        : [],
    [selectedRecord]
  );

  const selectedIndex = useMemo(
    () =>
      visibleRows.findIndex(
        (row) =>
          row.id ===
          effectiveSelectedId
      ),
    [
      effectiveSelectedId,
      visibleRows,
    ]
  );

  const previousRecord =
    selectedIndex > 0
      ? visibleRows[
          selectedIndex - 1
        ]
      : undefined;

  const nextRecord =
    selectedIndex >= 0 &&
    selectedIndex <
      visibleRows.length - 1
      ? visibleRows[
          selectedIndex + 1
        ]
      : undefined;
  const taskExecutionDetails =
    selectedRecord
      ? [
          {
            label: "Status",
            value:
              getDashboardStatusLabel(
                selectedRecord.status
              ),
            badgeClassName:
              getDashboardStatusBadgeClasses(
                selectedRecord.status
              ),
          },
          {
            label: "Processtap",
            value: selectedRecord.stap,
          },
          {
            label: "Voortgang",
            value: `${selectedRecord.voortgang}%`,
          },
          {
            label: "Recordmanager",
            value:
              selectedRecord.recordmanager,
          },
          {
            label: "Proceseigenaar",
            value:
              selectedRecord.proceseigenaar,
          },
          {
            label: "Archivaris",
            value:
              selectedRecord.archivaris,
          },
          {
            label: "Startdatum",
            value:
              selectedRecord.startdatum,
          },
          {
            label: "Frequentie",
            value:
              selectedRecord.frequentie,
          },
          {
            label: "Omvang dossiers",
            value: `${selectedRecord.dossierTelling} dossiers`,
          },
          {
            label: "Dagen in stap",
            value: `${selectedRecord.dagenInStap} dagen`,
          },
        ]
      : [];

  const activeRecordId =
    selectedRecord?.id ?? null;
  const selectedPanelData =
    selectedRecord
      ? dashboardTaskExecutionPanelById[
          selectedRecord.id
        ]
      : undefined;

  const dashboardTableRows = useMemo(
    () =>
      visibleRows.map((row) => {
        return {
          id: row.id,
          taakuitvoering: row.naam,
          stapId: row.stapId,
          status: row.status,
          voortgangLabel: row.stap,
          progress: row.voortgang,
          recordmanager:
            row.recordmanager,
          startdatum:
            row.startdatum,
        };
      }),
    [visibleRows]
  );

  const activeDecision =
    panelState.recordId === activeRecordId
      ? panelState.decision
      : "openen";

  function handlePrimaryAction() {
    if (!selectedRecord) {
      return;
    }

    if (activeDecision === "herinneren" || activeDecision === "herplannen") {
      console.info("Actie uitgevoerd", activeDecision, selectedRecord.id);
      return;
    }

    navigate(`/taak/${selectedRecord.id}/taakuitvoering/${selectedRecord.id}`);
  }

  function handleSecondaryAction() {
    if (!selectedRecord) {
      return;
    }

    navigate(`/taak/${selectedRecord.id}/taakuitvoering/${selectedRecord.id}`);
  }

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      const target =
        event.target as
          | HTMLElement
          | null;

      const tagName =
        target?.tagName ?? "";
      const isTyping =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      const key =
        event.key.toLowerCase();

      if (
        key === "a" &&
        previousRecord
      ) {
        event.preventDefault();
        setSelectedId(
          previousRecord.id
        );
      }

      if (
        key === "d" &&
        nextRecord
      ) {
        event.preventDefault();
        setSelectedId(nextRecord.id);
      }

      if (key === "w") {
        event.preventDefault();
        handlePrimaryAction();
      }

      if (key === "o" && selectedRecord) {
        event.preventDefault();
        handleSecondaryAction();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    nextRecord,
    previousRecord,
    selectedRecord,
  ]);

  return (
    <>
      <AppShellPortal slot="detail">
        {selectedRecord ? (
          <RecordDetailsPanel
            heading="Taakuitvoering details"
            record={{
              titel:
                selectedPanelData?.record
                  .titel ??
                selectedRecord.naam,
            }}
            comments={
              selectedPanelData?.comments ??
              []
            }
            showTabs={false}
            currentIndex={
              selectedIndex >= 0
                ? selectedIndex + 1
                : 0
            }
            totalCount={
              visibleRows.length
            }
            onPrevious={
              previousRecord
                ? () =>
                    setSelectedId(
                      previousRecord.id
                    )
                : undefined
            }
            onNext={
              nextRecord
                ? () =>
                    setSelectedId(nextRecord.id)
                : undefined
            }
            details={
              taskExecutionDetails
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
            Selecteer een taak om details te zien.
          </div>
        )}
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
            selectedRecord ? (
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label={
                    activeDecision ===
                      "herinneren" ||
                    activeDecision ===
                      "herplannen"
                      ? "Actie uitvoeren"
                      : "Taak openen"
                  }
                  variant="primary"
                  onClick={handlePrimaryAction}
                />
                <ActionPanelButton
                  label="Taak openen"
                  variant="secondary"
                  onClick={handleSecondaryAction}
                />
              </ActionPanelButtonGroup>
            ) : undefined
          }
        >
          {!selectedRecord ? (
            <ActionPanelEmptyState
              title="Geen taak geselecteerd"
              description="Kies eerst een taak in de werkvoorraad om de beschikbare actie te zien."
            />
          ) : (
            <ActionPanelSection
              title="Kies een actie"
            >
              <div className="space-y-3">
                {decisions.map((item) => (
                  <ActionPanelChoice
                    key={item.id}
                    title={item.title}
                    description={item.description ?? ""}
                    icon={item.icon}
                    tone={item.tone}
                    density="compact"
                    selected={activeDecision === item.id}
                    onClick={() =>
                      setPanelState({
                        recordId: activeRecordId,
                        decision: item.id,
                      })
                    }
                  />
                ))}
              </div>
            </ActionPanelSection>
          )}
        </ActionPanel>
      </AppShellPortal>

      <AppShellPortal slot="shortcut">
        <ShortcutPane
          shortcuts={[
            { keyLabel: "A", label: "Vorige" },
            { keyLabel: "D", label: "Volgende" },
            { keyLabel: "W", label: "Actie uitvoeren" },
            { keyLabel: "O", label: "Taak openen" },
          ]}
        />
      </AppShellPortal>

      <ContentPanel>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <TaskExecutionHeader
            title="Dashboard"
            activeStep="BEOORDELING"
            summaryStats={
              dashboardSummaryStats
            }
            metaItems={
              dashboardTaskMetaItems
            }
            showStatusOverview={false}
          />

          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-hidden border-t border-slate-200">
              <DashboardRecordPanel
                recordId={activeRecordId}
                rows={dashboardTableRows}
                onSelect={setSelectedId}
                searchValue={search}
                onSearchChange={setSearch}
                tabs={tabs}
                activeTab={scope}
                onTabChange={(key) =>
                  setScope(key as WorkloadScope)
                }
                filters={filters}
                activeFilter={filter}
                onFilterChange={(key) =>
                  setFilter(key as WorkloadFilter)
                }
              />
            </div>
          </div>
        </div>
      </ContentPanel>
    </>
  );
}
