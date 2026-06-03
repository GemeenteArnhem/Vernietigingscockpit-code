import { useEffect, useMemo, useState } from "react";
import { Archive, Download, FileOutput } from "lucide-react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
  ActionPanelShortcuts,
} from "../components/ActionPanel";
import RecordPaneBar, {
  type RecordPaneBarFilter,
  type RecordPaneBarFilterSection,
  type RecordPaneBarItem,
  type RecordPaneBarTab,
  type RecordPaneBarTone,
} from "../components/record-pane/RecordPaneBar";
import DestructionResultRecordPanel from "../features/task-execution/results/components/DestructionResultRecordPanel";
import {
  destructionResultActions,
  destructionResultContexts,
} from "../shared/mocks/destructionResultPage";
import { destructionResultRows } from "../shared/mocks/destructionResultRows";
import type {
  DestructionResultAction,
  DestructionResultContext,
  DestructionResultStatus,
} from "../shared/types/destructionResult";

type ResultStatusFilter = "alle" | DestructionResultStatus;

function getStatusTone(status: DestructionResultStatus): RecordPaneBarTone {
  switch (status) {
    case "SUCCES":
      return "success";
    case "FOUT":
      return "danger";
    case "NIET_GEVONDEN":
      return "warning";
    default:
      return "neutral";
  }
}

function getStatusLabel(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCES":
      return "Succes";
    case "FOUT":
      return "Fout";
    case "NIET_GEVONDEN":
      return "Niet gevonden";
    default:
      return "Overig";
  }
}

export default function DestructionResultPage() {
  const [search, setSearch] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] =
    useState<ResultStatusFilter>("alle");
  const [activeSourceFilter, setActiveSourceFilter] = useState("alle");
  const [selectedAction, setSelectedAction] = useState<DestructionResultAction>(
    destructionResultActions[0]?.id ?? "verklaring-downloaden"
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    destructionResultRows[0]?.id ?? null
  );

  const resultRows = useMemo(() => destructionResultRows, []);
  const contextById = useMemo<Record<string, DestructionResultContext>>(
    () =>
      Object.fromEntries(
        destructionResultContexts.map((context) => [context.recordId, context])
      ),
    []
  );
  const sourceOptions = useMemo(
    () => [
      "alle",
      ...Array.from(
        new Set(resultRows.map((row) => row.bron_systeem ?? row.stekker))
      ),
    ],
    [resultRows]
  );
  const filters = useMemo<RecordPaneBarFilter[]>(() => [], []);
  const tabs = useMemo<RecordPaneBarTab[]>(() => [], []);
  const filterSections = useMemo<RecordPaneBarFilterSection[]>(
    () => [
      {
        key: "status",
        label: "Status",
        activeKey: activeStatusFilter,
        onChange: (key) => setActiveStatusFilter(key as ResultStatusFilter),
        options: [
          { key: "alle", label: "Alle", count: resultRows.length },
          {
            key: "SUCCES",
            label: "Succes",
            count: resultRows.filter((row) => row.vernietigingsstatus === "SUCCES").length,
          },
          {
            key: "FOUT",
            label: "Fouten",
            count: resultRows.filter((row) => row.vernietigingsstatus === "FOUT").length,
          },
          {
            key: "NIET_GEVONDEN",
            label: "Niet gevonden",
            count: resultRows.filter((row) => row.vernietigingsstatus === "NIET_GEVONDEN").length,
          },
          {
            key: "OVERIG",
            label: "Overige",
            count: resultRows.filter((row) => row.vernietigingsstatus === "OVERIG").length,
          },
        ],
      },
      {
        key: "bron",
        label: "Bronsysteem",
        activeKey: activeSourceFilter,
        onChange: setActiveSourceFilter,
        options: sourceOptions.map((source) => ({
          key: source,
          label: source === "alle" ? "Alle" : source,
          count:
            source === "alle"
              ? resultRows.length
              : resultRows.filter((row) => (row.bron_systeem ?? row.stekker) === source).length,
        })),
      },
    ],
    [activeSourceFilter, activeStatusFilter, resultRows, sourceOptions]
  );
  const visibleRows = useMemo(
    () =>
      resultRows.filter((row) => {
        const matchesSearch =
          row.titel.toLowerCase().includes(search.toLowerCase()) ||
          row.stekker.toLowerCase().includes(search.toLowerCase()) ||
          row.bron_id?.toLowerCase().includes(search.toLowerCase()) ||
          row.melding?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          activeStatusFilter === "alle"
            ? true
            : row.vernietigingsstatus === activeStatusFilter;
        const matchesSource =
          activeSourceFilter === "alle"
            ? true
            : (row.bron_systeem ?? row.stekker) === activeSourceFilter;

        return matchesSearch && matchesStatus && matchesSource;
      }),
    [activeSourceFilter, activeStatusFilter, resultRows, search]
  );
  const effectiveSelectedId = useMemo(() => {
    if (selectedId && visibleRows.some((row) => row.id === selectedId)) {
      return selectedId;
    }

    return visibleRows[0]?.id ?? null;
  }, [selectedId, visibleRows]);

  const selectedIndex = useMemo(
    () => visibleRows.findIndex((row) => row.id === effectiveSelectedId),
    [effectiveSelectedId, visibleRows]
  );
  const selectedRow = useMemo(
    () => visibleRows.find((row) => row.id === effectiveSelectedId) ?? visibleRows[0],
    [effectiveSelectedId, visibleRows]
  );
  const selectedContext = selectedRow ? contextById[selectedRow.id] : undefined;
  const previousRecord = selectedIndex > 0 ? visibleRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < visibleRows.length - 1
      ? visibleRows[selectedIndex + 1]
      : undefined;
  const selectedActionConfig = useMemo(
    () => destructionResultActions.find((action) => action.id === selectedAction),
    [selectedAction]
  );
  const paneItems = useMemo<RecordPaneBarItem[]>(
    () =>
      visibleRows.map((row) => ({
        id: row.id,
        title: row.titel,
        stepLabel: row.stekker,
        stepTone: getStatusTone(row.vernietigingsstatus),
        status: getStatusLabel(row.vernietigingsstatus),
      })),
    [visibleRows]
  );

  const executeSelectedAction = () => {
    if (!selectedRow || !selectedActionConfig) {
      return;
    }

    console.info("Actie uitgevoerd", selectedActionConfig.id, selectedRow.id);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isTyping =
        tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable;

      if (isTyping) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "a" && previousRecord) {
        event.preventDefault();
        setSelectedId(previousRecord.id);
      }

      if (key === "d" && nextRecord) {
        event.preventDefault();
        setSelectedId(nextRecord.id);
      }

      if (key === "w" && selectedRow && selectedActionConfig) {
        event.preventDefault();
        console.info("Actie uitgevoerd", selectedActionConfig.id, selectedRow.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextRecord, previousRecord, selectedActionConfig, selectedRow]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <RecordPaneBar
        title="Resultaten"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Zoek resultaat..."
        tabs={tabs}
        activeTab=""
        onTabChange={() => undefined}
        filters={filters}
        activeFilter=""
        onFilterChange={() => undefined}
        filterSections={filterSections}
        items={paneItems}
        selectedId={effectiveSelectedId}
        onSelect={setSelectedId}
        emptyMessage="Geen resultaten gevonden binnen deze selectie."
        density="compact"
        showItemMeta={false}
      />

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <DestructionResultRecordPanel
          record={selectedRow}
          context={selectedContext}
          currentIndex={selectedIndex >= 0 ? selectedIndex + 1 : 0}
          totalCount={visibleRows.length}
          onPrevious={previousRecord ? () => setSelectedId(previousRecord.id) : undefined}
          onNext={nextRecord ? () => setSelectedId(nextRecord.id) : undefined}
        />

        <ActionPanel
          title="Acties"
          subtitle="Kies de vervolgstap voor het geselecteerde resultaat."
          footer={
            selectedRow ? (
              <div className="space-y-2.5">
                <ActionPanelButtonGroup>
                  <ActionPanelButton
                    label="Actie uitvoeren"
                    variant="primary"
                    onClick={executeSelectedAction}
                  />
                </ActionPanelButtonGroup>

                <ActionPanelShortcuts
                  shortcuts={[
                    { keyLabel: "A", label: "Vorige" },
                    { keyLabel: "D", label: "Volgende" },
                    { keyLabel: "W", label: "Actie uitvoeren" },
                  ]}
                />
              </div>
            ) : null
          }
        >
          {!selectedRow ? (
            <ActionPanelEmptyState
              title="Kies eerst een resultaat"
              description="Na selectie tonen we hier de beschikbare uitvoeracties voor dit resultaat."
            />
          ) : (
            <ActionPanelSection
              title="Kies een actie"
              description="De resultaatdetails staan links. Kies hier alleen de vervolgstap."
            >
              <div className="space-y-3">
                {destructionResultActions.map((action) => (
                  <ActionPanelChoice
                    key={action.id}
                    title={action.title}
                    description={action.description}
                    icon={
                      action.id === "verklaring-downloaden" ? (
                        <Download size={18} />
                      ) : action.id === "resultaat-exporteren" ? (
                        <FileOutput size={18} />
                      ) : (
                        <Archive size={18} />
                      )
                    }
                    tone={action.tone}
                    density="compact"
                    selected={selectedAction === action.id}
                    onClick={() => setSelectedAction(action.id)}
                  />
                ))}
              </div>
            </ActionPanelSection>
          )}
        </ActionPanel>
      </div>
    </div>
  );
}
