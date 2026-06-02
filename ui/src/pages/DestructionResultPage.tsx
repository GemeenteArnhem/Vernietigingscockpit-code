import { useEffect, useMemo, useState } from "react";
import { Archive, Download, FileOutput, Filter, TableProperties } from "lucide-react";

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
import { destructionResultContexts } from "../shared/mocks/destructionResultPage";
import { destructionResultRows } from "../shared/mocks/destructionResultRows";
import type {
  DestructionResultColumnKey,
  DestructionResultContext,
  DestructionResultStatus,
} from "../shared/types/destructionResult";

const COLUMN_DEFAULTS: Record<DestructionResultColumnKey, boolean> = {
  omvang: false,
  vernietigingsdatum: false,
  bron_id: false,
  code: false,
  grondslag: false,
  bron_systeem: false,
  melding: false,
};

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
  const [selectedId, setSelectedId] = useState<string | null>(
    destructionResultRows[0]?.id ?? null
  );
  const [visibleColumns, setVisibleColumns] =
    useState<Record<DestructionResultColumnKey, boolean>>(COLUMN_DEFAULTS);

  const toggleColumn = (key: DestructionResultColumnKey) => {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

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

  useEffect(() => {
    if (!visibleRows.some((row) => row.id === selectedId)) {
      setSelectedId(visibleRows[0]?.id ?? null);
    }
  }, [selectedId, visibleRows]);

  const selectedIndex = useMemo(
    () => visibleRows.findIndex((row) => row.id === selectedId),
    [selectedId, visibleRows]
  );
  const selectedRow = useMemo(
    () => visibleRows.find((row) => row.id === selectedId) ?? visibleRows[0],
    [selectedId, visibleRows]
  );
  const selectedContext = selectedRow ? contextById[selectedRow.id] : undefined;
  const previousRecord = selectedIndex > 0 ? visibleRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < visibleRows.length - 1
      ? visibleRows[selectedIndex + 1]
      : undefined;
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextRecord, previousRecord]);

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
        selectedId={selectedRow?.id ?? null}
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
          subtitle="Filter de resultaatlijst en beheer welke informatie je in deze stap wilt tonen of exporteren."
          footer={
            <div className="space-y-2.5">
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Verklaring downloaden"
                  variant="primary"
                  onClick={() => undefined}
                />
                <ActionPanelButton
                  label="Exporteren"
                  variant="secondary"
                  onClick={() => undefined}
                />
                <ActionPanelButton
                  label="Archiveren"
                  variant="secondary"
                  onClick={() => undefined}
                />
              </ActionPanelButtonGroup>

              <ActionPanelShortcuts
                shortcuts={[
                  { keyLabel: "A", label: "Vorige" },
                  { keyLabel: "D", label: "Volgende" },
                ]}
              />
            </div>
          }
        >
          {!selectedRow ? (
            <ActionPanelEmptyState
              title="Kies eerst een resultaat"
              description="Na selectie tonen we hier de filters, kolominstellingen en uitvoeracties."
            />
          ) : (
            <>
              <ActionPanelSection
                title="Statusfilter"
                description="Verfijn de resultatenlijst op uitkomst van de vernietigingsactie."
              >
                <div className="space-y-2">
                  {[
                    { key: "alle", title: "Alle resultaten", description: "Toon alle verwerkte records.", icon: <Filter size={18} />, tone: "primary" as const },
                    { key: "SUCCES", title: "Succes", description: "Alleen records die succesvol zijn verwijderd.", icon: <Download size={18} />, tone: "success" as const },
                    { key: "FOUT", title: "Fouten", description: "Records met een fout tijdens de uitvoering.", icon: <Archive size={18} />, tone: "danger" as const },
                    { key: "NIET_GEVONDEN", title: "Niet gevonden", description: "Records die niet meer in de bron aanwezig waren.", icon: <FileOutput size={18} />, tone: "warning" as const },
                    { key: "OVERIG", title: "Overige", description: "Records met een alternatieve of overgeslagen uitkomst.", icon: <TableProperties size={18} />, tone: "neutral" as const },
                  ].map((item) => (
                    <ActionPanelChoice
                      key={item.key}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                      tone={item.tone}
                      density="compact"
                      selected={activeStatusFilter === item.key}
                      onClick={() => setActiveStatusFilter(item.key as ResultStatusFilter)}
                    />
                  ))}
                </div>
              </ActionPanelSection>

              <ActionPanelSection
                title="Kolommen"
                description="Bepaal welke aanvullende metadata zichtbaar moeten zijn in deze resultaatweergave."
              >
                <div className="space-y-2">
                  {(
                    [
                      ["omvang", "Omvang"],
                      ["vernietigingsdatum", "Vernietigingsdatum"],
                      ["bron_id", "Bron-ID"],
                      ["code", "Code"],
                      ["grondslag", "Grondslag"],
                      ["bron_systeem", "Bronsysteem"],
                      ["melding", "Melding"],
                    ] as Array<[DestructionResultColumnKey, string]>
                  ).map(([key, label]) => (
                    <ActionPanelChoice
                      key={key}
                      title={label}
                      description={
                        visibleColumns[key]
                          ? "Deze kolom staat aan in de resultaatweergave."
                          : "Deze kolom staat nu uit."
                      }
                      icon={<TableProperties size={18} />}
                      tone={visibleColumns[key] ? "primary" : "neutral"}
                      density="compact"
                      selected={visibleColumns[key]}
                      onClick={() => toggleColumn(key)}
                    />
                  ))}
                </div>
              </ActionPanelSection>
            </>
          )}
        </ActionPanel>
      </div>
    </div>
  );
}
