import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ClipboardList,
  FolderOpen,
  PencilLine,
  PlayCircle,
  PlugZap,
} from "lucide-react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
} from "../components/ActionPanel";
import ContentPanel, {
  ContentPanelEmptyState,
} from "../components/ContentPanel";
import ShortcutPane from "../components/ShortcutPane";
import type {
  RecordPaneBarFilter,
  RecordPaneBarTab,
} from "../components/record-pane/RecordPaneBar";
import TaskDefinitionDetailPane from "../features/task-definition/components/TaskDefinitionDetailPane";
import TaskDefinitionRecordPanel from "../features/task-definition/components/TaskDefinitionRecordPanel";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import { taskDefinitionRecords } from "../shared/mocks/taskDefinitionPage";
import type {
  TaskDefinitionExecutionStatus,
  TaskDefinitionInstance,
  TaskDefinitionRecord,
} from "../shared/types/taskDefinition";

type DefinitionFilter =
  | "alle"
  | "actie"
  | "lopend"
  | "gepland";

type TaskDefinitionDecisionId =
  | "open-uitvoering"
  | "bewerk-configuratie"
  | "koppel-stekker";

type TaskDefinitionDecision = {
  id: TaskDefinitionDecisionId;
  title: string;
  icon: ReactNode;
  tone: "primary" | "success" | "warning";
};

function getPrimaryInstance(
  definition: TaskDefinitionRecord
) {
  return (
    definition.instanties.find(
      (instantie) =>
        instantie.highlighted
    ) ??
    definition.instanties.find(
      (instantie) =>
        instantie.status ===
          "VERTRAAGD" ||
        instantie.status ===
          "LOPEND"
    ) ??
    definition.instanties.find(
      (instantie) =>
        instantie.status ===
        "GEPLAND"
    ) ??
    definition.instanties[0]
  );
}

function getDefinitionStatus(
  definition: TaskDefinitionRecord
): TaskDefinitionExecutionStatus {
  if (
    definition.instanties.some(
      (instantie) =>
        instantie.status ===
        "VERTRAAGD"
    )
  ) {
    return "VERTRAAGD";
  }

  if (
    definition.instanties.some(
      (instantie) =>
        instantie.status ===
        "LOPEND"
    )
  ) {
    return "LOPEND";
  }

  if (
    definition.instanties.some(
      (instantie) =>
        instantie.status ===
        "GEPLAND"
    )
  ) {
    return "GEPLAND";
  }

  return "VOLTOOID";
}

function getDefinitionStatusLabel(
  status: TaskDefinitionExecutionStatus
) {
  switch (status) {
    case "VERTRAAGD":
      return "Vertraagd";
    case "LOPEND":
      return "Lopend";
    case "GEPLAND":
      return "Gepland";
    default:
      return "Voltooid";
  }
}

function getDefinitionStepLabel(
  definition: TaskDefinitionRecord
) {
  const primaryInstance =
    getPrimaryInstance(
      definition
    );

  return (
    primaryInstance?.stap ??
    "Geen uitvoeringen"
  );
}

function getTaskDefinitionDecisions(
  definition: TaskDefinitionRecord
): TaskDefinitionDecision[] {
  const primaryInstance =
    getPrimaryInstance(
      definition
    );
  const today =
    new Date("2026-07-01");
  const plannedStartDate =
    primaryInstance?.plannedStartDate
      ? new Date(
          primaryInstance.plannedStartDate
        )
      : null;

  let primaryActionTitle =
    "Laatste uitvoering openen";
  let primaryActionIcon =
    <FolderOpen size={18} />;
  let primaryActionTone:
    | "primary"
    | "success"
    | "warning" = "primary";

  if (
    primaryInstance?.status ===
      "LOPEND" ||
    primaryInstance?.status ===
      "VERTRAAGD"
  ) {
    primaryActionTitle =
      "Lopende uitvoering openen";
  } else if (
    primaryInstance?.status ===
    "GEPLAND"
  ) {
    primaryActionTitle =
      plannedStartDate &&
      plannedStartDate > today
        ? "Geplande uitvoering vervroegd starten"
        : "Geplande uitvoering starten";
    primaryActionIcon =
      <PlayCircle size={18} />;
    primaryActionTone =
      "warning";
  }

  return [
    {
      id: "open-uitvoering",
      title:
        primaryActionTitle,
      icon: primaryActionIcon,
      tone: primaryActionTone,
    },
    {
      id: "bewerk-configuratie",
      title:
        "Taakdetails bewerken",
      icon: <PencilLine size={18} />,
      tone: "primary",
    },
    {
      id: "koppel-stekker",
      title:
        "Stekkers beheren",
      icon: <PlugZap size={18} />,
      tone: "success",
    },
  ];
}

function openInstance(
  navigate: ReturnType<
    typeof useNavigate
  >,
  definitionId: string,
  instance?: TaskDefinitionInstance
) {
  if (!instance) {
    return;
  }

  const stap =
    instance.stap.toLowerCase();

  if (stap === "beoordeling") {
    navigate(
      `/taak/${definitionId}/taakuitvoering/${instance.id}/selectie`
    );
    return;
  }

  navigate(
    `/taak/${definitionId}/taakuitvoering/${instance.id}`
  );
}

export default function TaskDefinitionDetailPage() {
  const navigate =
    useNavigate();
  const { id: taakId } =
    useParams();

  const [search, setSearch] =
    useState("");
  const [filter, setFilter] =
    useState<DefinitionFilter>(
      "alle"
    );
  const [panelState, setPanelState] =
    useState<{
      recordId: string | null;
      decision: TaskDefinitionDecisionId;
    }>({
      recordId:
        taskDefinitionRecords[0]
          ?.id ?? null,
      decision:
        "open-uitvoering",
    });

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

  const visibleDefinitions =
    useMemo(() => {
      return taskDefinitionRecords.filter(
        (definition) => {
          const status =
            getDefinitionStatus(
              definition
            );

          const matchesFilter =
            filter === "alle" ||
            (filter === "actie" &&
              (status ===
                "VERTRAAGD" ||
                status ===
                  "LOPEND")) ||
            (filter === "lopend" &&
              status ===
                "LOPEND") ||
            (filter === "gepland" &&
              status ===
                "GEPLAND");

          const needle =
            search.toLowerCase();
          const matchesSearch =
            definition.naam
              .toLowerCase()
              .includes(needle) ||
            definition.categorie
              .toLowerCase()
              .includes(needle) ||
            definition.frequentie
              .toLowerCase()
              .includes(needle);

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );
    }, [filter, search]);

  const effectiveSelectedId =
    visibleDefinitions.some(
      (item) => item.id === taakId
    )
      ? taakId ?? null
      : visibleDefinitions[0]
          ?.id ?? null;

  useEffect(() => {
    if (
      effectiveSelectedId &&
      taakId !==
        effectiveSelectedId
    ) {
      navigate(
        `/taak/${effectiveSelectedId}`,
        { replace: true }
      );
    }
  }, [
    effectiveSelectedId,
    navigate,
    taakId,
  ]);

  const tabs = useMemo<
    RecordPaneBarTab[]
  >(
    () =>
      [
        {
          key: "alle",
          label: "Alle taakdefinities",
          count: taskDefinitionRecords.length,
        },
      ],
    []
  );

  const selectedDefinition =
    useMemo(
      () =>
        visibleDefinitions.find(
          (definition) =>
            definition.id ===
            effectiveSelectedId
        ),
      [
        effectiveSelectedId,
        visibleDefinitions,
      ]
    );

  const selectedIndex =
    useMemo(
      () =>
        visibleDefinitions.findIndex(
          (definition) =>
            definition.id ===
            effectiveSelectedId
        ),
      [
        effectiveSelectedId,
        visibleDefinitions,
      ]
    );

  const previousDefinition =
    selectedIndex > 0
      ? visibleDefinitions[
          selectedIndex - 1
        ]
      : undefined;
  const nextDefinition =
    selectedIndex >= 0 &&
    selectedIndex <
      visibleDefinitions.length - 1
      ? visibleDefinitions[
          selectedIndex + 1
        ]
      : undefined;

  const decisions = useMemo(
    () =>
      selectedDefinition
        ? getTaskDefinitionDecisions(
            selectedDefinition
          )
        : [],
    [selectedDefinition]
  );

  const activeRecordId =
    selectedDefinition?.id ?? null;
  const activeDecision =
    panelState.recordId ===
    activeRecordId
      ? panelState.decision
      : "open-uitvoering";

  const primaryInstance =
    selectedDefinition
      ? getPrimaryInstance(
          selectedDefinition
        )
      : undefined;

  const selectedStatus =
    selectedDefinition
      ? getDefinitionStatus(
          selectedDefinition
        )
      : undefined;

  const detailItems =
    selectedDefinition
      ? [
          {
            label: "Taaknaam",
            value: selectedDefinition.naam,
          },
          {
            label: "Categorie",
            value:
              selectedDefinition.categorie,
          },
          {
            label: "Frequentie",
            value:
              selectedDefinition.frequentie,
          },
          {
            label: "Status",
            value:
              getDefinitionStatusLabel(
                selectedStatus ??
                  "VOLTOOID"
              ),
          },
          {
            label: "Actieve stap",
            value:
              getDefinitionStepLabel(
                selectedDefinition
              ),
          },
          {
            label: "Recordmanager",
            value:
              primaryInstance
                ?.recordmanager ??
              "Niet toegewezen",
          },
          {
            label: "Proceseigenaar",
            value:
              selectedDefinition.proceseigenaar,
          },
          {
            label: "Archivaris",
            value:
              selectedDefinition.archivaris,
          },
        ]
      : [];

  const tableRows =
    useMemo(
      () =>
        visibleDefinitions.map(
          (definition) => {
            const primary =
              getPrimaryInstance(
                definition
              );

            return {
              id: definition.id,
              taakdefinitie:
                definition.naam,
              categorie:
                definition.categorie,
              stap:
                getDefinitionStepLabel(
                  definition
                ),
              recordmanager:
                primary
                  ?.recordmanager ??
                "Niet toegewezen",
              proceseigenaar:
                definition.proceseigenaar,
              frequentie:
                definition.frequentie,
              uitvoeringen:
                definition.instanties.length,
              stekkers:
                definition.stekkers.length,
            };
          }
        ),
      [visibleDefinitions]
    );

  const handlePrimaryAction =
    () => {
      if (
        !selectedDefinition
      ) {
        return;
      }

      if (
        activeDecision ===
        "open-uitvoering"
      ) {
        openInstance(
          navigate,
          selectedDefinition.id,
          primaryInstance
        );
        return;
      }

      if (
        activeDecision ===
        "bewerk-configuratie"
      ) {
        console.info(
          "Configuratie bewerken",
          selectedDefinition.id
        );
        return;
      }

      console.info(
        "Stekkers beheren",
        selectedDefinition.id
      );
    };

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
        tagName ===
          "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) {
        return;
      }

      const key =
        event.key.toLowerCase();

      if (
        key === "a" &&
        previousDefinition
      ) {
        event.preventDefault();
        navigate(
          `/taak/${previousDefinition.id}`
        );
      }

      if (
        key === "d" &&
        nextDefinition
      ) {
        event.preventDefault();
        navigate(
          `/taak/${nextDefinition.id}`
        );
      }

      if (key === "w") {
        event.preventDefault();
        handlePrimaryAction();
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
  });

  return (
    <>
      <AppShellPortal slot="detail">
        {selectedDefinition ? (
          <TaskDefinitionDetailPane
            definition={
              selectedDefinition
            }
            currentIndex={
              selectedIndex >= 0
                ? selectedIndex + 1
                : 0
            }
            totalCount={
              visibleDefinitions.length
            }
            details={detailItems}
            onPrevious={
              previousDefinition
                ? () =>
                    navigate(
                      `/taak/${previousDefinition.id}`
                    )
                : undefined
            }
            onNext={
              nextDefinition
                ? () =>
                    navigate(
                      `/taak/${nextDefinition.id}`
                    )
                : undefined
            }
            onOpenExecution={(
              instance
            ) =>
              openInstance(
                navigate,
                selectedDefinition.id,
                instance
              )
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
            Selecteer een taakdefinitie om details te zien.
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
            selectedDefinition ? (
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Actie uitvoeren"
                  onClick={handlePrimaryAction}
                  variant="primary"
                />
              </ActionPanelButtonGroup>
            ) : null
          }
        >
          {!selectedDefinition ? (
            <ActionPanelEmptyState
              title="Kies eerst een taakdefinitie"
              description="Kies een taakdefinitie om een actie te tonen."
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
                    description=""
                    icon={item.icon}
                    tone={item.tone}
                    density="compact"
                    selected={activeDecision === item.id}
                    onClick={() =>
                      setPanelState({
                        recordId: selectedDefinition.id,
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
          ]}
        />
      </AppShellPortal>

      {visibleDefinitions.length === 0 ? (
        <ContentPanel>
          <ContentPanelEmptyState
            icon={
              <ClipboardList size={24} />
            }
            title="Geen taakdefinities gevonden"
            description="Pas je zoekopdracht of filters aan om taakdefinities te tonen."
          />
        </ContentPanel>
      ) : (
        <TaskDefinitionRecordPanel
          recordId={
            effectiveSelectedId
          }
          rows={tableRows}
          onSelect={(id) =>
            navigate(`/taak/${id}`)
          }
          searchValue={search}
          onSearchChange={setSearch}
          tabs={tabs}
          activeTab="alle"
          onTabChange={() => {}}
          filters={filters}
          activeFilter={filter}
          onFilterChange={(key) =>
            setFilter(
              key as DefinitionFilter
            )
          }
        />
      )}
    </>
  );
}

