import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FolderOpen,
  PencilLine,
  PlayCircle,
  PlugZap,
  Settings2,
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
  ActionPanelShortcuts,
} from "../components/ActionPanel";
import ContentPanel, {
  ContentPanelBody,
  ContentPanelEmptyState,
  ContentPanelHeader,
} from "../components/ContentPanel";
import RecordPaneBar, {
  type RecordPaneBarFilter,
  type RecordPaneBarItem,
} from "../components/record-pane/RecordPaneBar";
import type { Connector } from "../features/task-definition/components/ConnectorTable";
import TaskDefinitionConfiguration, {
  type TaskDefinitionConfigurationData,
} from "../features/task-definition/components/TaskDefinitionConfiguration";
import TaskDefinitionInstances, {
  type TaskDefinitionInstance,
} from "../features/task-definition/components/TaskDefinitionInstances";

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

type TaskDefinitionRecord = {
  id: string;
  naam: string;
  subtitle: string;
  categorie: string;
  frequentie: string;
  proceseigenaar: string;
  archivaris: string;
  instanties: TaskDefinitionInstance[];
  stekkers: Connector[];
};

const mockTaskDefinitions: TaskDefinitionRecord[] = [
  {
    id: "zorgdomein-jaarlijks",
    naam: "Zorgdomein jaarlijks",
    subtitle:
      "Basistaak voor de jaarlijkse vernietigingsronde binnen het zorgdomein.",
    categorie: "Zorgdomein",
    frequentie: "Jaarlijks",
    proceseigenaar: "Jan de Vries",
    archivaris: "R. de Vries",
    instanties: [
      {
        id: "1",
        naam: "Zorgdomein 2026",
        subtitle: "Volgende instantie • 1 februari 2026",
        recordmanager: "Jan de Vries",
        status: "GEPLAND",
        stap: "Startmoment",
        voortgang: 0,
        plannedStartDate: "2026-02-01",
      },
      {
        id: "2",
        naam: "Zorgdomein 2025",
        subtitle: "Gestart 3 februari 2025",
        recordmanager: "Jan de Vries",
        status: "LOPEND",
        stap: "Beoordeling",
        voortgang: 40,
        highlighted: true,
      },
      {
        id: "3",
        naam: "Zorgdomein 2024",
        subtitle: "8 feb - 14 mrt 2024",
        recordmanager: "Jan de Vries",
        status: "VOLTOOID",
        stap: "Vernietiging",
        voortgang: 100,
      },
      {
        id: "4",
        naam: "Zorgdomein 2023",
        subtitle: "6 feb - 22 mrt 2023",
        recordmanager: "Jan de Vries",
        status: "VOLTOOID",
        stap: "Vernietiging",
        voortgang: 100,
      },
    ],
    stekkers: [
      {
        id: "1",
        naam: "Suite4sociaaldomein",
        type: "Taakapplicatie",
        omschrijving: "Bestaanszekerheid",
        status: "SUCCES",
      },
      {
        id: "2",
        naam: "Djuma",
        type: "Zaaksysteem",
        omschrijving: "Zaakdossiers",
        status: "SUCCES",
      },
    ],
  },
  {
    id: "hr-dossiers-kwartaal",
    naam: "HR dossiers kwartaal",
    subtitle:
      "Terugkerende taakdefinitie voor personeelsdossiers met kwartaalritme.",
    categorie: "Bedrijfsvoering",
    frequentie: "Per kwartaal",
    proceseigenaar: "S. Janssen",
    archivaris: "M. Blom",
    instanties: [
      {
        id: "5",
        naam: "HR dossiers Q2 2026",
        subtitle: "Gestart 4 mei 2026",
        recordmanager: "S. Janssen",
        status: "VERTRAAGD",
        stap: "Accordering PO",
        voortgang: 70,
        highlighted: true,
      },
      {
        id: "6",
        naam: "HR dossiers Q1 2026",
        subtitle: "Afgerond 28 maart 2026",
        recordmanager: "S. Janssen",
        status: "VOLTOOID",
        stap: "Vernietiging",
        voortgang: 100,
      },
      {
        id: "7",
        naam: "HR dossiers Q3 2026",
        subtitle: "Volgende instantie • 4 augustus 2026",
        recordmanager: "S. Janssen",
        status: "GEPLAND",
        stap: "Startmoment",
        voortgang: 0,
        plannedStartDate: "2026-08-04",
      },
    ],
    stekkers: [
      {
        id: "3",
        naam: "AFAS",
        type: "Bronsysteem",
        omschrijving: "Personeelsdossiers",
        status: "SUCCES",
      },
      {
        id: "4",
        naam: "SharePoint archief",
        type: "Archiefbron",
        omschrijving: "Aanvullende bijlagen",
        status: "WAARSCHUWING",
      },
    ],
  },
  {
    id: "subsidiearchief-meerjarig",
    naam: "Subsidiearchief meerjarig",
    subtitle:
      "Meerjarige taakdefinitie voor afgesloten subsidiedossiers en nazorg.",
    categorie: "Sociaal domein",
    frequentie: "Eenmalig",
    proceseigenaar: "R. Bakker",
    archivaris: "F. van Dijk",
    instanties: [
      {
        id: "8",
        naam: "Subsidiearchief 2015-2018",
        subtitle: "Volgende instantie • 18 juni 2026",
        recordmanager: "R. Bakker",
        status: "GEPLAND",
        stap: "Startmoment",
        voortgang: 0,
        plannedStartDate: "2026-06-18",
        highlighted: true,
      },
      {
        id: "9",
        naam: "Subsidiearchief 2011-2014",
        subtitle: "Afgerond 16 november 2025",
        recordmanager: "R. Bakker",
        status: "VOLTOOID",
        stap: "Vernietiging",
        voortgang: 100,
      },
    ],
    stekkers: [
      {
        id: "5",
        naam: "Djuma",
        type: "Zaaksysteem",
        omschrijving: "Subsidiedossiers",
        status: "SUCCES",
      },
    ],
  },
];

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
) {
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

function getDefinitionRiskCopy(
  definition: TaskDefinitionRecord
) {
  const status =
    getDefinitionStatus(
      definition
    );

  if (status === "VERTRAAGD") {
    return {
      label: "Directe opvolging",
      className:
        "border border-red-200 bg-red-50 text-red-700",
      summary:
        "Er staat minimaal één uitvoering stil in een vervolgstap en vraagt actie.",
    };
  }

  if (status === "GEPLAND") {
    return {
      label: "Voorbereiding",
      className:
        "border border-amber-200 bg-amber-50 text-amber-700",
      summary:
        "De volgende uitvoering staat gepland en de configuratie is leidend voor de start.",
    };
  }

  if (status === "VOLTOOID") {
    return {
      label: "Historisch",
      className:
        "border border-slate-200 bg-slate-100 text-slate-700",
      summary:
        "Alle bekende uitvoeringen zijn afgerond; deze definitie blijft beschikbaar als referentie.",
    };
  }

  return {
    label: "Op schema",
    className:
      "border border-green-200 bg-green-50 text-green-700",
    summary:
      "Er is een actieve uitvoering en de configuratie ondersteunt het lopende proces.",
  };
}

function getTaskDefinitionDecisions(
  definition: TaskDefinitionRecord
): TaskDefinitionDecision[] {
  const primaryInstance =
    getPrimaryInstance(
      definition
    );
  const today =
    new Date("2026-05-31");
  const plannedStartDate =
    primaryInstance?.plannedStartDate
      ? new Date(
          primaryInstance.plannedStartDate
        )
      : null;

  let primaryActionTitle =
    "Laatste taak openen";
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
      "Lopende taak openen";
  } else if (
    primaryInstance?.status ===
    "GEPLAND"
  ) {
    primaryActionTitle =
      plannedStartDate &&
      plannedStartDate > today
        ? "Geplande taak vervroegd starten"
        : "Geplande taak starten";
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
        "Taakinformatie bewerken",
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
        mockTaskDefinitions[0]
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
      return mockTaskDefinitions.filter(
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

  const paneItems = useMemo<
    RecordPaneBarItem[]
  >(
    () =>
      visibleDefinitions.map(
        (definition) => {
          const status =
            getDefinitionStatus(
              definition
            );

          return {
            id: definition.id,
            title: definition.naam,
            stepLabel:
              getDefinitionStepLabel(
                definition
              ),
            stepTone:
              status ===
              "VERTRAAGD"
                ? "danger"
                : status ===
                    "LOPEND"
                  ? "info"
                  : status ===
                    "GEPLAND"
                    ? "warning"
                    : "success",
            status,
          };
        }
      ),
    [visibleDefinitions]
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

  const risk =
    selectedDefinition
      ? getDefinitionRiskCopy(
          selectedDefinition
        )
      : null;

  const configuratie:
    | TaskDefinitionConfigurationData
    | undefined =
    selectedDefinition
      ? {
          taaknaam:
            selectedDefinition.naam,
          categorie:
            selectedDefinition.categorie,
          frequentie:
            selectedDefinition.frequentie,
          proceseigenaar:
            selectedDefinition.proceseigenaar,
          archivaris:
            selectedDefinition.archivaris,
        }
      : undefined;

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
        "Stekker beheren",
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

      if (key === "o" && selectedDefinition) {
        event.preventDefault();
        openInstance(
          navigate,
          selectedDefinition.id,
          primaryInstance
        );
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
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <RecordPaneBar
        title="Taakdefinities"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Zoek taakdefinitie..."
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
        filters={filters}
        activeFilter={filter}
        onFilterChange={(key) =>
          setFilter(
            key as DefinitionFilter
          )
        }
        items={paneItems}
        selectedId={
          effectiveSelectedId
        }
        onSelect={(id) =>
          navigate(`/taak/${id}`)
        }
        emptyMessage="Geen taakdefinities gevonden binnen deze selectie."
      />

      {!selectedDefinition ||
      !configuratie ||
      !risk ? (
        <ContentPanel>
          <ContentPanelEmptyState
            icon={
              <Settings2 size={24} />
            }
            title="Kies een taakdefinitie"
            description="Na selectie tonen we hier het overzicht van uitvoeringen, configuratie en gekoppelde bronnen."
          />
        </ContentPanel>
      ) : (
        <ContentPanel>
          <ContentPanelBody>
            <ContentPanelHeader
              eyebrow="Taakdefinitie"
              title={
                selectedDefinition.naam
              }
              subtitle={
                selectedDefinition.subtitle
              }
            />

            <TaskDefinitionConfiguration
              configuratie={
                configuratie
              }
              stekkers={
                selectedDefinition.stekkers
              }
            />

            <TaskDefinitionInstances
              instanties={
                selectedDefinition.instanties
              }
              onOpen={(instanceId) => {
                const instance =
                  selectedDefinition.instanties.find(
                    (item) =>
                      item.id ===
                      instanceId
                  );

                openInstance(
                  navigate,
                  selectedDefinition.id,
                  instance
                );
              }}
            />
          </ContentPanelBody>
        </ContentPanel>
      )}

      <ActionPanel
        title="Acties"
        subtitle="Snelle vervolgstappen voor de geselecteerde taakdefinitie."
        footer={
          selectedDefinition ? (
            <div className="space-y-2.5">
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label="Actie uitvoeren"
                  onClick={
                    handlePrimaryAction
                  }
                  variant="primary"
                />
                <ActionPanelButton
                  label="Open uitvoering"
                  onClick={() =>
                    openInstance(
                      navigate,
                      selectedDefinition.id,
                      primaryInstance
                    )
                  }
                  variant="secondary"
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
                      label: "Open uitvoering",
                    },
                ]}
              />
            </div>
          ) : null
        }
      >
        {!selectedDefinition ? (
          <ActionPanelEmptyState
            title="Kies eerst een taakdefinitie"
            description="Na selectie tonen we hier de aanbevolen vervolgstappen voor uitvoeringen en configuratie."
          />
        ) : (
          <>
            <ActionPanelSection
              title="Kies een actie"
              description="De details staan links. Kies hier alleen de vervolgstap."
            >
              <div className="space-y-3">
                {decisions.map(
                  (item) => (
                    <ActionPanelChoice
                      key={item.id}
                      title={item.title}
                      description={
                        item.id === "open-uitvoering"
                          ? "Open de meest relevante taakuitvoering vanuit deze definitie."
                          : item.id === "bewerk-configuratie"
                            ? "Werk taakinformatie, rollen en instellingen bij."
                            : "Beheer gekoppelde bronnen en stekkers voor deze definitie."
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
                            selectedDefinition.id,
                          decision:
                            item.id,
                        })
                      }
                    />
                  )
                )}
              </div>
            </ActionPanelSection>
          </>
        )}
      </ActionPanel>
    </div>
  );
}
