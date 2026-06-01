import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  FolderOpen,
} from "lucide-react";
import RecordPaneBar, {
  type RecordPaneBarFilter,
  type RecordPaneBarItem,
  type RecordPaneBarTab,
} from "../components/record-pane/RecordPaneBar";
import DashboardRecordPanel from "../components/dashboard/DashboardRecordPanel";
import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
  ActionPanelShortcuts,
} from "../components/ActionPanel";
import type { DashboardTaskRecord } from "../shared/types/dashboard";

type WorkloadScope = "mijn" | "alle";
type WorkloadFilter = "alle" | "actie" | "lopend" | "gepland";

const mockRows: DashboardTaskRecord[] = [
  {
    id: "1",
    naam: "HR dossiers kwartaal",
    subtitle: "Gestart 4 mei 2026",
    status: "VERTRAAGD",
    eigenaar: "mijn",
    stap: "Accordering PO",
    voortgang: 70,
    dagenInStap: 10,
    recordmanager: "S. Janssen",
    frequentie: "Kwartaal",
    dossierTelling: 124,
  },
  {
    id: "2",
    naam: "Zorgdomein jaarlijks",
    subtitle: "Gestart 10 mei 2026",
    status: "LOPEND",
    eigenaar: "mijn",
    stap: "Selectiecontrole",
    voortgang: 40,
    dagenInStap: 4,
    recordmanager: "Jan de Vries",
    frequentie: "Jaarlijks",
    dossierTelling: 86,
  },
  {
    id: "3",
    naam: "Facilitair archief voorjaar",
    subtitle: "Start gepland op 6 juni 2026",
    status: "GEPLAND",
    eigenaar: "mijn",
    stap: "Wachten op startmoment",
    voortgang: 0,
    dagenInStap: 0,
    recordmanager: "M. Blom",
    frequentie: "Halfjaarlijks",
    dossierTelling: 42,
  },
  {
    id: "4",
    naam: "Projectdossiers sociaal domein",
    subtitle: "Gestart 18 mei 2026",
    status: "LOPEND",
    eigenaar: "team",
    stap: "Controle metagegevens",
    voortgang: 55,
    dagenInStap: 3,
    recordmanager: "F. van Dijk",
    frequentie: "Maandelijks",
    dossierTelling: 213,
  },
  {
    id: "5",
    naam: "Subsidiearchief 2015-2018",
    subtitle: "Gestart 12 mei 2026",
    status: "VERTRAAGD",
    eigenaar: "team",
    stap: "Akkoord proceseigenaar",
    voortgang: 80,
    dagenInStap: 8,
    recordmanager: "R. Bakker",
    frequentie: "Eenmalig",
    dossierTelling: 59,
  },
];

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

export default function DashboardPage() {
  const [search, setSearch] =
    useState("");

  const [scope, setScope] =
    useState<WorkloadScope>("mijn");

  const [filter, setFilter] =
    useState<WorkloadFilter>("alle");

  const [selectedId, setSelectedId] =
    useState<string | null>(
      mockRows[0]?.id ?? null
    );

  const [panelState, setPanelState] =
    useState<{
      recordId: string | null;
      decision: DashboardDecisionId;
    }>({
      recordId: mockRows[0]?.id ?? null,
      decision: "openen",
    });

  const tabs = useMemo<
    RecordPaneBarTab[]
  >(
    () => [
      {
        key: "mijn",
        label: "Mijn werkvoorraad",
        count: mockRows.filter(
          (row) =>
            row.eigenaar === "mijn"
        ).length,
      },
      {
        key: "alle",
        label: "Alle",
        count: mockRows.length,
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
    return mockRows.filter((row) => {
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

      const matchesSearch =
        row.naam
          .toLowerCase()
          .includes(
            search.toLowerCase()
          );

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

  const activeRecordId =
    selectedRecord?.id ?? null;

  const activeDecision =
    panelState.recordId === activeRecordId
      ? panelState.decision
      : "openen";

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
        setPanelState({
          recordId:
            activeRecordId,
          decision:
            selectedRecord?.status ===
            "GEPLAND"
              ? "starten"
              : "openen",
        });
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
    activeRecordId,
    nextRecord,
    previousRecord,
    selectedRecord?.status,
  ]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* RB */}
      <RecordPaneBar
        title="Taken"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Zoek taak..."
        tabs={tabs}
        activeTab={scope}
        onTabChange={(key) =>
          setScope(
            key as WorkloadScope
          )
        }
        filters={filters}
        activeFilter={filter}
        onFilterChange={(key) =>
          setFilter(
            key as WorkloadFilter
          )
        }
        items={paneItems}
        selectedId={
          effectiveSelectedId
        }
        onSelect={setSelectedId}
        emptyMessage="Geen taken gevonden binnen deze selectie."
      />

      {/* CONTENT */}
      <DashboardRecordPanel
        record={selectedRecord}
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
                setSelectedId(
                  nextRecord.id
                )
            : undefined
        }
      />

      {/* ACTION */}
      <ActionPanel
        title="Acties"
        subtitle="Snelle vervolgstappen voor de geselecteerde taak."
        footer={
          selectedRecord ? (
            <div className="space-y-2.5">
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label={
                    decisions.find(
                      (item) =>
                        item.id ===
                        activeDecision
                    )?.title ??
                    "Open taak"
                  }
                  variant="primary"
                />
              </ActionPanelButtonGroup>

              <ActionPanelShortcuts
                shortcuts={[
                  {
                    keyLabel: "A",
                    label: "Vorige",
                  },
                  {
                    keyLabel: "D",
                    label: "Volgende",
                  },
                    {
                      keyLabel: "W",
                      label: "Actie uitvoeren",
                    },
                ]}
              />
            </div>
          ) : null
        }
      >
        {!selectedRecord ? (
          <ActionPanelEmptyState
            title="Kies eerst een taak"
            description="Na selectie tonen we hier de aanbevolen vervolgstap, notities en snelle acties."
          />
        ) : (
          <>
            <ActionPanelSection
              title="Kies een actie"
              description="De details staan links. Kies hier alleen de vervolgstap."
            >
              <div className="space-y-3">
                {decisions.map((item) => (
                  <ActionPanelChoice
                    key={item.id}
                    title={item.title}
                    description={
                      item.description ??
                      ""
                    }
                    icon={item.icon}
                    tone={item.tone}
                    selected={
                      activeDecision ===
                      item.id
                    }
                    onClick={() =>
                      setPanelState({
                        recordId:
                          activeRecordId,
                        decision: item.id,
                      })
                    }
                  />
                ))}
              </div>
            </ActionPanelSection>
          </>
        )}
      </ActionPanel>

    </div>
  );
}
