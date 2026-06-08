import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FolderOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
            value: "Jan de Vries",
          },
          {
            label: "Archivaris",
            value: "M. Blom",
          },
          {
            label: "Startdatum",
            value: selectedRecord.subtitle
              .replace(/^Gestart\s+/i, "")
              .replace(
                /^Start gepland op\s+/i,
                ""
              ),
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

  const dashboardTableRows = useMemo(
    () =>
      visibleRows.map((row) => {
        const startdatum =
          row.subtitle
            .replace(/^Gestart\s+/i, "")
            .replace(
              /^Start gepland op\s+/i,
              ""
            );

        return {
          id: row.id,
          taakuitvoering: row.naam,
          voortgangLabel: row.stap,
          progress: row.voortgang,
          recordmanager:
            row.recordmanager,
          startdatum,
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
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* RB */}
      <RecordPaneBar
        title="Taakuitvoering details"
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
        widthClassName="w-[340px]"
        hideHeader
        hideList
        flush
        panelContent={
          selectedRecord ? (
            <section className="flex min-h-full flex-col bg-white">
              <div className="border-b border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold text-slate-900">
                    Taakuitvoering details
                  </p>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={
                        previousRecord
                          ? () =>
                              setSelectedId(
                                previousRecord.id
                              )
                          : undefined
                      }
                      disabled={!previousRecord}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Vorige taak"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="min-w-12 text-center text-xs font-semibold text-slate-500">
                      {visibleRows.length > 0 &&
                      selectedIndex >= 0
                        ? `${selectedIndex + 1} van ${visibleRows.length}`
                        : "0 van 0"}
                    </span>
                    <button
                      type="button"
                      onClick={
                        nextRecord
                          ? () =>
                              setSelectedId(
                                nextRecord.id
                              )
                          : undefined
                      }
                      disabled={!nextRecord}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Volgende taak"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <h2 className="text-lg font-semibold leading-7 tracking-tight text-slate-950">
                  {selectedRecord.naam}
                </h2>

                <div className="pt-4">
                  <dl className="space-y-0">
                    {taskExecutionDetails.map(
                      (item) => (
                        <div
                          key={item.label}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0"
                        >
                          <dt className="text-[13px] font-medium leading-5 text-slate-500">
                            {item.label}
                          </dt>
                          <dd className="text-[13px] font-semibold leading-5 text-slate-900">
                            {item.badgeClassName ? (
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${item.badgeClassName}`}
                              >
                                {item.value}
                              </span>
                            ) : (
                              item.value
                            )}
                          </dd>
                        </div>
                      )
                    )}
                  </dl>
                </div>
              </div>
            </section>
          ) : null
        }
      />

      {/* CONTENT */}
      <DashboardRecordPanel
        recordId={activeRecordId}
        rows={dashboardTableRows}
        onSelect={setSelectedId}
        searchValue={search}
        onSearchChange={setSearch}
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
                  label="Actie uitvoeren"
                  variant="primary"
                  onClick={handlePrimaryAction}
                />
                <ActionPanelButton
                  label="Taak openen"
                  variant="secondary"
                  onClick={handleSecondaryAction}
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
                    {
                      keyLabel: "O",
                      label: "Taak openen",
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
                    density="compact"
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
