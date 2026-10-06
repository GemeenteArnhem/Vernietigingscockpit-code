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
  FilePlus2,
  PlayCircle,
  PlugZap,
  Trash2,
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
import {
  createTaskInstance,
  getTaskDefinitions,
  verwijderTaakdefinitie,
  verwijderTaakuitvoering,
} from "../api/f3Data";
import { serverFoutmelding } from "../api/apiClient";
import ConfirmDialog from "../components/ConfirmDialog";
import { heeftDashboard } from "../auth/authConfig";
import ActieFoutmelding from "../components/ActieFoutmelding";
import { useSessionUser } from "../auth/useSessionUser";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import type {
  TaskDefinitionExecutionStatus,
  TaskDefinitionInstance,
  TaskDefinitionRecord,
} from "../shared/types/taskDefinition";
import { getTaskExecutionRoute } from "../shared/workflowRoutes";

// Vaste lege lijst, zodat useMemo-afhankelijkheden niet bij elke render veranderen.
const EMPTY_DEFINITIONS: TaskDefinitionRecord[] = [];

type DefinitionFilter =
  | "alle"
  | "actie"
  | "lopend"
  | "gepland";

type TaskDefinitionDecisionId =
  | "open-uitvoering"
  | "nieuwe-uitvoering"
  | "bewerk-configuratie"
  | "koppel-stekker"
  | "uitvoering-verwijderen"
  | "taak-verwijderen"
  | "nieuwe-taak";

type TaskDefinitionDecision = {
  id: TaskDefinitionDecisionId;
  title: string;
  icon: ReactNode;
  tone: "primary" | "success" | "warning" | "danger";
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
  const apiActions =
    definition.toegestaneActies;
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

  const decisions: TaskDefinitionDecision[] = [
    {
      id: "open-uitvoering",
      title:
        primaryActionTitle,
      icon: primaryActionIcon,
      tone: primaryActionTone,
    },
  ];

  if (!apiActions || apiActions.includes("taakinstantie.aanmaken")) {
    decisions.push({
      id: "nieuwe-uitvoering",
      title: "Nieuwe uitvoering aanmaken",
      icon: <PlayCircle size={18} />,
      tone: "success",
    });
  }

  if (!apiActions || apiActions.includes("taakdefinitie.bewerken")) {
    decisions.push({
      id: "bewerk-configuratie",
      title:
        "Taakdetails bewerken",
      icon: <PencilLine size={18} />,
      tone: "primary",
    });
  }

  // Verwijderen door de functioneel beheerder (de API bepaalt of het mag).
  if (primaryInstance?.toegestaneActies?.includes("taakinstantie.verwijderen")) {
    decisions.push({
      id: "uitvoering-verwijderen",
      title: `Uitvoering ${primaryInstance.naam} verwijderen`,
      icon: <Trash2 size={18} />,
      tone: "danger",
    });
  }

  if (apiActions?.includes("taakdefinitie.verwijderen")) {
    decisions.push({
      id: "taak-verwijderen",
      title: "Taak verwijderen",
      icon: <Trash2 size={18} />,
      tone: "danger",
    });
  }

  if (!apiActions) {
    decisions.push({
      id: "koppel-stekker",
      title:
        "Stekkers beheren",
      icon: <PlugZap size={18} />,
      tone: "success",
    });
  }

  return decisions;
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

  navigate(
    getTaskExecutionRoute({
      taakdefinitieId: definitionId,
      taakinstantieId: instance.id,
      stap: instance.stap,
    })
  );
}

export default function TaskDefinitionDetailPage() {
  const navigate =
    useNavigate();
  const { id: taakId } =
    useParams();
  const { accessToken, user } =
    useSessionUser();
  // Beheerder en auditor zien alle taken.
  const scope =
    user.roles.includes("functioneel_beheerder") || user.roles.includes("auditor")
      ? "alle"
      : "mijn";
  // Zonder werkvoorraadrol (de beheerder) heeft een taakuitvoering openen geen zin.
  const kanUitvoeringOpenen = heeftDashboard(user.roles);
  // Een nieuwe taak aanmaken: recordmanager en functioneel beheerder (ook zonder selectie).
  const kanTaakAanmaken =
    user.roles.includes("recordmanager") || user.roles.includes("functioneel_beheerder");
  const [herladen, setHerladen] = useState(0);
  const [bevestigVerwijderen, setBevestigVerwijderen] = useState(false);
  const [bezigVerwijderen, setBezigVerwijderen] = useState(false);
  const [
    apiDefinitions,
    setApiDefinitions,
  ] = useState<
    TaskDefinitionRecord[] | null
  >(null);
  const [apiError, setApiError] =
    useState<string | null>(null);
  const [
    isCreatingInstance,
    setIsCreatingInstance,
  ] = useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);

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
      recordId: null,
      decision:
        "open-uitvoering",
    });

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isCurrent = true;

    getTaskDefinitions(accessToken, scope)
      .then((definitions) => {
        if (isCurrent) {
          setApiDefinitions(
            definitions
          );
          setApiError(null);
        }
      })
      .catch((caught) => {
        if (isCurrent) {
          setApiDefinitions([]);
          setApiError(
            caught instanceof Error
              ? caught.message
              : "Taakdefinities laden is mislukt."
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, herladen, scope]);

  const definitions = apiDefinitions ?? EMPTY_DEFINITIONS;

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
      return definitions.filter(
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
    }, [definitions, filter, search]);

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
          count: definitions.length,
        },
      ],
    [definitions.length]
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

  const decisions = useMemo(() => {
    const lijst = selectedDefinition
      ? getTaskDefinitionDecisions(
          selectedDefinition
        ).filter(
          (decision) =>
            kanUitvoeringOpenen ||
            decision.id !== "open-uitvoering"
        )
      : [];

    if (kanTaakAanmaken) {
      lijst.push({
        id: "nieuwe-taak",
        title: "Nieuwe taakdefinitie",
        icon: <FilePlus2 size={18} />,
        tone: "success",
      });
    }

    return lijst;
  }, [kanTaakAanmaken, kanUitvoeringOpenen, selectedDefinition]);

  const activeRecordId =
    selectedDefinition?.id ?? null;
  const gekozenDecision =
    panelState.recordId ===
    activeRecordId
      ? panelState.decision
      : "open-uitvoering";
  const activeDecision: TaskDefinitionDecisionId =
    decisions.some((decision) => decision.id === gekozenDecision)
      ? gekozenDecision
      : decisions[0]?.id ?? "open-uitvoering";

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
    async () => {
      if (activeDecision === "nieuwe-taak") {
        navigate("/taak/nieuw");
        return;
      }

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

      if (
        activeDecision ===
        "nieuwe-uitvoering"
      ) {
        if (
          !accessToken ||
          isCreatingInstance
        ) {
          return;
        }

        setIsCreatingInstance(true);
        setActionError(null);

        try {
          const instantie =
            await createTaskInstance(
              accessToken,
              selectedDefinition.id
            );

          setApiDefinitions((current) =>
            current
              ? current.map((definition) =>
                  definition.id ===
                  selectedDefinition.id
                    ? {
                        ...definition,
                        instanties: [
                          instantie,
                          ...definition.instanties.map(
                            (item) => ({
                              ...item,
                              highlighted: false,
                            })
                          ),
                        ],
                      }
                    : definition
                )
              : current
          );
          openInstance(
            navigate,
            selectedDefinition.id,
            instantie
          );
        } catch (error) {
          setActionError(
            error instanceof Error
              ? error.message
              : "Taakuitvoering aanmaken is mislukt."
          );
        } finally {
          setIsCreatingInstance(false);
        }

        return;
      }

      if (
        activeDecision === "uitvoering-verwijderen" ||
        activeDecision === "taak-verwijderen"
      ) {
        setActionError(null);
        setBevestigVerwijderen(true);
        return;
      }

      console.info(
        "Stekkers beheren",
        selectedDefinition.id
      );
    };

  const handleVerwijderen = async () => {
    if (!accessToken || !selectedDefinition) {
      return;
    }

    setBezigVerwijderen(true);

    try {
      if (activeDecision === "taak-verwijderen") {
        await verwijderTaakdefinitie(accessToken, selectedDefinition.id);
      } else if (primaryInstance) {
        await verwijderTaakuitvoering(accessToken, selectedDefinition.id, primaryInstance.id);
      }
      setHerladen((teller) => teller + 1);
    } catch (caught) {
      setActionError(serverFoutmelding(caught, "Verwijderen is mislukt."));
    } finally {
      setBezigVerwijderen(false);
      setBevestigVerwijderen(false);
    }
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
            decisions.length > 0 ? (
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
          {decisions.length === 0 ? (
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
                    onClick={() => {
                      setActionError(null);
                      setPanelState({
                        recordId: activeRecordId,
                        decision: item.id,
                      });
                    }}
                  />
                ))}
                <ActieFoutmelding melding={actionError} />
              </div>
            </ActionPanelSection>
          )}
        </ActionPanel>
      </AppShellPortal>

      <ConfirmDialog
        open={bevestigVerwijderen}
        title={
          activeDecision === "taak-verwijderen"
            ? `Taak ${selectedDefinition?.naam ?? ""} verwijderen?`
            : `Uitvoering ${primaryInstance?.naam ?? ""} verwijderen?`
        }
        description={
          activeDecision === "taak-verwijderen"
            ? "De taak en al haar uitvoeringen verdwijnen uit de cockpit. Zijn er uitvoeringen geweest, dan blijven hun gegevens en auditlog bewaard en staat het verwijderen in het log."
            : "De uitvoering verdwijnt uit de cockpit. Haar gegevens en auditlog blijven bewaard en het verwijderen staat in het log."
        }
        confirmLabel={bezigVerwijderen ? "Bezig..." : "Ja, verwijderen"}
        onCancel={() => setBevestigVerwijderen(false)}
        onConfirm={() => {
          if (!bezigVerwijderen) {
            void handleVerwijderen();
          }
        }}
      />

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
          {apiError ? (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          ) : null}
          <ContentPanelEmptyState
            icon={
              <ClipboardList size={24} />
            }
            title="Geen taakdefinities gevonden"
            description="Pas je zoekopdracht of filters aan om taakdefinities te tonen."
          />
        </ContentPanel>
      ) : (
        <>
          {apiError ? (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          ) : null}
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
        </>
      )}
    </>
  );
}

