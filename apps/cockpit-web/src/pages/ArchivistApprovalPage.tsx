import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCheck,
  SendToBack,
} from "lucide-react";

import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelEmptyState,
  ActionPanelSection,
  ActionPanelTextarea,
} from "../components/ActionPanel";
import ShortcutPane from "../components/ShortcutPane";
import ConfirmDialog from "../components/ConfirmDialog";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import ReviewRecordPanel from "../features/task-execution/review/components/ReviewRecordPanel";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  bulkAccordering,
  submitArchivarisAccordering,
  updateArchivarisAccordering,
  type UpdateProceseigenaarAccorderingInput,
} from "../api/f3Data";
import { useSessionUser } from "../auth/useSessionUser";
import { getReviewQueueStatusStyle } from "../shared/ui/reviewStatusStyles";
import type {
  ReviewComment,
  ReviewDecision,
  ReviewQueueStatus,
  ReviewRecordContext,
} from "../shared/types/review";
import type { VernietigingsKandidaat } from "../shared/types/destruction";
import ActieFoutmelding from "../components/ActieFoutmelding";
import {
  PAGINA_GROOTTE,
  useKandidatenLijst,
  useSelectieSamenvatting,
} from "../features/task-execution/review/useKandidatenLijst";
import { maakBulkDetails } from "../features/task-execution/review/bulkDetails";

// Vaste lege lijsten, zodat useMemo-afhankelijkheden niet bij elke render veranderen.
const EMPTY_ROWS: VernietigingsKandidaat[] = [];
const EMPTY_CONTEXTS: ReviewRecordContext[] = [];
const EMPTY_IDS: string[] = [];

type ReviewAction = "open" | "akkoord" | "retour";

const BULK_SELECTION_KEY = "__bulk__";

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
      return "Akkoord";
    case "conflict":
      return "Uitgesloten";
    case "retour":
      return "Retour";
    case "uitgesteld":
      return "Uitgesteld";
    default:
      return "Open";
  }
}

function getQueueStatusBadgeClasses(status: ReviewQueueStatus) {
  return getReviewQueueStatusStyle(status).badge;
}

const reviewActions = [
  {
    id: "akkoord" as const,
    title: "Akkoord",
    icon: <CheckCheck size={18} />,
    tone: "success" as const,
  },
  {
    id: "retour" as const,
    title: "Retour",
    icon: <SendToBack size={18} />,
    tone: "warning" as const,
  },
];

function mapActionToApiInput(
  action: ReviewAction,
  toelichting: string
): UpdateProceseigenaarAccorderingInput | null {
  const normalizedToelichting = toelichting.trim() || null;

  switch (action) {
    case "akkoord":
      return {
        besluit: "AKKOORD",
        toelichting: normalizedToelichting,
      };
    case "retour":
      return {
        besluit: "RETOUR",
        toelichting: normalizedToelichting,
      };
    default:
      return null;
  }
}

export default function ArchivistApprovalPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const { accessToken } = useSessionUser();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Lokale besluiten tot de volgende verversing van de pagina; daarna telt de server.
  const [decisions, setDecisions] =
    useState<Record<string, ReviewDecision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [deferredRecords, setDeferredRecords] = useState<Record<string, boolean>>({});
  const [selectedActions, setSelectedActions] = useState<Record<string, ReviewAction>>({});
  const [manualComments, setManualComments] = useState<Record<string, ReviewComment[]>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // De server pagineert, zoekt, filtert en sorteert (CC-10); hier staat één pagina.
  const uitgesteldeIds = useMemo(
    () => Object.keys(deferredRecords).filter((recordId) => deferredRecords[recordId]),
    [deferredRecords]
  );
  const lijst = useKandidatenLijst({ accessToken, taakId: id, uitgesteldeIds });
  const taakVersie = lijst.data?.taakVersie ?? null;
  const apiRows = lijst.data?.rows ?? null;
  const serverDecisions = lijst.data?.decisions;
  const alleDecisions = useMemo(
    () => ({ ...(serverDecisions ?? {}), ...decisions }),
    [decisions, serverDecisions]
  );

  const sourceRows = apiRows ?? EMPTY_ROWS;
  const sourceContexts = lijst.data?.contexts ?? EMPTY_CONTEXTS;
  const volgnummers = lijst.data?.volgnummers;

  const contextById = useMemo(
    () => Object.fromEntries(sourceContexts.map((context) => [context.recordId, context])),
    [sourceContexts]
  );

  const queueRows = useMemo(
    () =>
      sourceRows.map((row, index) => {
        const context = contextById[row.id];
        const computedStatus = getDecisionStatus(alleDecisions[row.id] ?? "open");
        const isDeferred = deferredRecords[row.id] === true;
        const queueStatus = isDeferred
          ? "uitgesteld"
          : alleDecisions[row.id] && alleDecisions[row.id] !== "open"
            ? computedStatus
            : context?.queueStatus ?? "nog-te-beoordelen";

        return {
          row,
          context: context
            ? {
                ...context,
                comments: [...context.comments, ...(manualComments[row.id] ?? [])],
              }
            : context,
          queueStatus,
          snapshotVolgnummer: volgnummers?.[row.id] ?? index + 1,
        };
      }),
    [alleDecisions, contextById, deferredRecords, manualComments, sourceRows, volgnummers]
  );

  // Al gezocht, gefilterd en gesorteerd door de server.
  const visibleRows = queueRows;

  const activeSelectedId = useMemo(
    () =>
      visibleRows.some((item) => item.row.id === selectedId)
        ? selectedId
        : visibleRows[0]?.row.id ?? null,
    [selectedId, visibleRows]
  );

  const selectedIndex = useMemo(
    () => visibleRows.findIndex((item) => item.row.id === activeSelectedId),
    [activeSelectedId, visibleRows]
  );

  const selectedItem = useMemo(
    () => visibleRows.find((item) => item.row.id === activeSelectedId) ?? visibleRows[0],
    [activeSelectedId, visibleRows]
  );

  const previousRecord = selectedIndex > 0 ? visibleRows[selectedIndex - 1] : undefined;
  const nextRecord =
    selectedIndex >= 0 && selectedIndex < visibleRows.length - 1
      ? visibleRows[selectedIndex + 1]
      : undefined;

  // Bij het eerste of laatste record van een pagina: door naar de vorige of volgende pagina.
  const naarVolgende = nextRecord
    ? () => setSelectedId(nextRecord.row.id)
    : lijst.heeftVolgendePagina
      ? () => lijst.naarPagina(lijst.pagina + 1)
      : undefined;
  const naarVorige = previousRecord
    ? () => setSelectedId(previousRecord.row.id)
    : lijst.heeftVorigePagina
      ? () => lijst.naarPagina(lijst.pagina - 1)
      : undefined;
  const isBulkMode = selectedTableIds.length > 1;
  const selectedBulkItems = useMemo(
    () =>
      isBulkMode
        ? visibleRows.filter((item) => selectedTableIds.includes(item.row.id))
        : [],
    [isBulkMode, selectedTableIds, visibleRows]
  );
  const actionTargetIds = isBulkMode
    ? selectedTableIds
    : selectedItem
      ? [selectedItem.row.id]
      : [];
  const bulkComments = useMemo(
    () =>
      selectedBulkItems.flatMap((item) =>
        (item.context?.comments ?? []).map((comment) => ({
          ...comment,
          role: `${comment.role} · ${item.row.titel}`,
        }))
      ),
    [selectedBulkItems]
  );
  const bulkSamenvatting = useSelectieSamenvatting(
    accessToken,
    id,
    isBulkMode ? selectedTableIds : EMPTY_IDS
  );
  const bulkDetails = isBulkMode
    ? maakBulkDetails(selectedBulkItems, selectedTableIds.length, bulkSamenvatting, getQueueStatusLabel)
    : [];

  const selectedDecision = isBulkMode
    ? selectedActions[BULK_SELECTION_KEY] ?? "open"
    : selectedItem
      ? selectedActions[selectedItem.row.id] ?? "open"
      : "open";
  const selectedNote = isBulkMode
    ? notes[BULK_SELECTION_KEY] ?? ""
    : selectedItem
      ? notes[selectedItem.row.id] ?? ""
      : "";
  const tellingen = lijst.data?.tellingen;
  // Over de hele lijst, niet alleen deze pagina.
  const allReviewed = (tellingen?.totaal ?? 0) > 0 && tellingen?.opgenomen === 0;
  const hasRetour = (tellingen?.retour ?? 0) > 0;
  const summaryStats = {
    teBeoordelen: tellingen?.opgenomen ?? 0,
    akkoord: tellingen?.akkoord ?? 0,
    retour: tellingen?.retour ?? 0,
    uitgesloten: tellingen?.uitgesloten ?? 0,
  };
  const reviewTableRows = useMemo(
    () =>
      visibleRows.map((item) => ({
        id: item.row.id,
        omschrijving: item.row.titel,
        queueStatus: item.queueStatus,
        volgnummer: item.snapshotVolgnummer,
        code: item.row.code ?? "-",
        selectielijst: item.row.selectielijst ?? "-",
        grondslag: item.row.grondslag ?? "-",
        bewaartermijn: `${item.row.bewaartermijn} jaar`,
        vernietigingsdatum: item.row.vernietigingsdatum ?? "-",
        opmerkingenCount: item.context?.comments.length ?? 0,
        aantalObjecten: item.row.aantalObjecten.toLocaleString("nl-NL"),
        aantalBetrokkenen: item.row.aantalBetrokkenen.toLocaleString("nl-NL"),
        periode: `${item.row.startdatum ?? "-"} / ${item.row.einddatum ?? "-"}`,
        stekker: item.row.bron_systeem ?? "-",
        bronId: item.row.bron_id ?? "-",
      })),
    [visibleRows]
  );

  const executeAction = async (action: ReviewAction) => {
    if (action === "open" || actionTargetIds.length === 0) {
      return;
    }

    setActionError(null);

    if (accessToken && id && apiRows) {
      const input = mapActionToApiInput(action, selectedNote);

      if (!input) {
        return;
      }

      setIsSavingAction(true);

      try {
        // Meerdere records: één verzoek voor de hele selectie (CC-10).
        if (actionTargetIds.length > 1 && taakVersie !== null) {
          await bulkAccordering(accessToken, id, taakVersie, actionTargetIds, input, "archivaris");
        } else {
          await Promise.all(
            actionTargetIds.map((kandidaatId) =>
              updateArchivarisAccordering(accessToken, id, kandidaatId, input)
            )
          );
        }
        lijst.ververs();
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Archivaris-accordering opslaan is mislukt."
        );
        setIsSavingAction(false);
        return;
      }

      setIsSavingAction(false);
    }

    setDeferredRecords((current) => {
      const nextState = { ...current };

      actionTargetIds.forEach((id) => {
        delete nextState[id];
      });

      return nextState;
    });

    setDecisions((current) => {
      const nextState = { ...current };
      actionTargetIds.forEach((id) => {
        nextState[id] = action;
      });
      return nextState;
    });

    if (selectedNote.trim()) {
      setManualComments((current) => {
        const nextState = { ...current };
        actionTargetIds.forEach((id) => {
          nextState[id] = [
            ...(nextState[id] ?? []),
            {
              author: "Archivaris",
              role: "Archivaris",
              message: selectedNote.trim(),
              timestamp: new Date().toLocaleString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ];
        });
        return nextState;
      });

      setNotes((current) => {
        const nextState = { ...current };
        if (isBulkMode) {
          delete nextState[BULK_SELECTION_KEY];
        } else if (selectedItem) {
          nextState[selectedItem.row.id] = "";
        }
        return nextState;
      });
    }

    setSelectedActions((current) => {
      const nextState = { ...current };
      if (isBulkMode) {
        delete nextState[BULK_SELECTION_KEY];
      } else if (selectedItem) {
        delete nextState[selectedItem.row.id];
      }
      return nextState;
    });

    if (isBulkMode) {
      setSelectedTableIds([]);
      return;
    }

    if (nextRecord) {
      setSelectedId(nextRecord.row.id);
      return;
    }

    if (lijst.heeftVolgendePagina) {
      lijst.naarPagina(lijst.pagina + 1);
      return;
    }

    if (allReviewed) {
      setConfirmOpen(true);
    }
  };

  const executeSelectedAction = () => {
    void executeAction(selectedDecision);
  };

  const handleSubmitDecision = async () => {
    if (!accessToken || !id || taakVersie === null || !taakId) {
      setActionError("Archivaris-accordering afronden kan pas nadat de taak via de API is geladen.");
      setConfirmOpen(false);
      return;
    }

    setActionError(null);
    setIsSavingAction(true);

    try {
      const result = await submitArchivarisAccordering(accessToken, id, taakVersie);
      setConfirmOpen(false);

      if (result.status === "beoordeling") {
        navigate(`/taak/${taakId}/taakuitvoering/${id}/beoordeling`);
        return;
      }

      navigate(`/taak/${taakId}/taakuitvoering/${id}/uitvoering`);
    } catch (error) {
      setConfirmOpen(false);
      setActionError(
        error instanceof Error
          ? error.message
          : "Archivaris-accordering afronden is mislukt."
      );
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const inputType =
        target instanceof HTMLInputElement ? target.type.toLowerCase() : "";
      const isTyping =
        tagName === "TEXTAREA" ||
        (tagName === "INPUT" &&
          !["checkbox", "radio", "button", "submit"].includes(inputType)) ||
        target?.isContentEditable;

      if (isTyping || (!selectedItem && !isBulkMode)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "y") {
        event.preventDefault();
        void executeAction("akkoord");
      }

      if (key === "t") {
        event.preventDefault();
        void executeAction("retour");
      }

      if (key === "w" && selectedDecision !== "open") {
        event.preventDefault();
        void executeAction(selectedDecision);
      }

      if (key === "a" && naarVorige) {
        event.preventDefault();
        naarVorige();
      }

      if (key === "d" && naarVolgende) {
        event.preventDefault();
        naarVolgende();
      }
    });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <AppShellPortal slot="detail">
        {selectedItem ? (
          <RecordDetailsPanel
            record={isBulkMode ? { titel: `Selectie van ${selectedTableIds.length} records` } : selectedItem.row}
            comments={isBulkMode ? bulkComments : selectedItem.context?.comments ?? []}
            currentIndex={isBulkMode ? 0 : selectedIndex >= 0 ? lijst.pagina * PAGINA_GROOTTE + selectedIndex + 1 : 0}
            totalCount={isBulkMode ? 0 : lijst.server.totaal}
            onPrevious={isBulkMode ? undefined : naarVorige}
            onNext={isBulkMode ? undefined : naarVolgende}
            heading={isBulkMode ? "Selectie" : "Record"}
            showTabs
            counterLabel={isBulkMode ? `${selectedTableIds.length} geselecteerd` : undefined}
            detailsNotice={
              isBulkMode
                ? "Je hebt meerdere records geselecteerd. Hieronder staat een samenvatting van de selectie. Waar waarden verschillen, tonen we dit expliciet."
                : undefined
            }
            emptyCommentsMessage={
              isBulkMode
                ? "Er zijn nog geen opmerkingen binnen deze selectie."
                : undefined
            }
            details={isBulkMode ? bulkDetails : [
              {
                label: "Omschrijving",
                labelTitle: "Titel vernietigen informatieobjecten binnen de taak",
                value: selectedItem.row.titel,
                stacked: true,
              },
              {
                label: "Code",
                labelTitle:
                  "De VNG code of BAC van de te vernietigen informatieobjecten binnen de taak. Voor selectielijst vanaf 2017, Zaaktype gebruiken.",
                value: selectedItem.row.code ?? "-",
              },
              {
                label: "Selectielijst",
                labelTitle:
                  "Selectielijst die van toepassing is, betreft jaartal van de selectielijst.",
                value: selectedItem.row.selectielijst ?? "-",
              },
              {
                label: "Grondslag",
                labelTitle:
                  "De categorie/grondslag uit de vignerende selectielijst op basis waarvan de informatieobjecten vernietigd dienen te worden",
                value: selectedItem.row.grondslag ?? "-",
              },
              {
                label: "Bewaartermijn",
                labelTitle:
                  "De periode dat de informatieobjecten moeten worden bewaard conform de vigerende selectielijst",
                value: `${selectedItem.row.bewaartermijn} jaar`,
              },
              {
                label: "Vernietigingsdatum",
                labelTitle:
                  "Jaar en maand waarin het dossier/informatieobject vernietigd moet worden. Format: jjjj-mm",
                value: selectedItem.row.vernietigingsdatum ?? "-",
              },
              {
                label: "Periode",
                labelTitle:
                  "Gehele periode waar de stukken binnen deze taak in vallen. Format jjjj-mm / jjjj-mm",
                value: `${selectedItem.row.startdatum ?? "-"} / ${selectedItem.row.einddatum ?? "-"}`,
              },
              {
                label: "Status",
                labelTitle:
                  "Status van beoordeling: Akkoord, Retour, Uitgesloten, Uitgesteld",
                value: getQueueStatusLabel(selectedItem.queueStatus),
                badgeClassName: getQueueStatusBadgeClasses(selectedItem.queueStatus),
              },
              {
                label: "Aantal objecten",
                labelTitle: "Aantal objecten",
                value: `${selectedItem.row.aantalObjecten}`,
              },
              {
                label: "Aantal betrokkenen",
                labelTitle: "Aantal betrokkenen",
                value: `${selectedItem.row.aantalBetrokkenen}`,
              },
              {
                label: "Stekker",
                labelTitle: "Naam van de stekker waar de informatieobjecten uit komt.",
                value: selectedItem.row.bron_systeem ?? "-",
              },
              {
                label: "Bron-ID",
                labelTitle: "Identificatie van het informatieobject uit de stekker",
                value: selectedItem.row.bron_id ?? "-",
              },
              {
                label: "ID",
                labelTitle: "Cockpit identicatienummer.",
                value: selectedItem.row.id,
              },
              {
                label: "Volgnummer",
                labelTitle:
                  "Een nummer binnen de taak die voor vernietiging in aanmerking komen",
                value: `${selectedItem.snapshotVolgnummer}`,
              },
            ]}
          />
        ) : null}
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
            selectedItem ? (
              <ActionPanelButtonGroup>
                <ActionPanelButton
                  label={isSavingAction ? "Opslaan..." : "Actie uitvoeren"}
                  variant="primary"
                  disabled={!selectedItem || selectedDecision === "open" || isSavingAction}
                  onClick={executeSelectedAction}
                />
                <ActionPanelButton
                  label={hasRetour ? "Retour naar recordmanager" : "Vrijgeven"}
                  variant="secondary"
                  disabled={!allReviewed || isSavingAction}
                  onClick={() => setConfirmOpen(true)}
                />
              </ActionPanelButtonGroup>
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
              <ActionPanelSection title="">
                {isBulkMode ? (
                  <p className="mb-3 text-sm leading-5 text-slate-500">
                    Je voert deze actie uit op {selectedTableIds.length} geselecteerde records.
                  </p>
                ) : null}
                <div className="space-y-2">
                  {reviewActions.map((item) => (
                    <ActionPanelChoice
                      key={item.id}
                      title={item.title}
                      icon={item.icon}
                      tone={item.tone}
                      density="compact"
                      selected={selectedDecision === item.id}
                      onClick={() =>
                        setSelectedActions((current) => ({
                          ...current,
                          [isBulkMode ? BULK_SELECTION_KEY : selectedItem.row.id]: item.id,
                        }))
                      }
                    />
                  ))}
                </div>
              </ActionPanelSection>

              <div>
                <ActionPanelTextarea
                  label={isBulkMode ? "Opmerking voor selectie" : "Opmerking"}
                  placeholder={
                    isBulkMode
                      ? "Voeg context toe die bij alle geselecteerde records wordt geplaatst..."
                      : "Voeg context toe voor de gekozen of voorgenomen actie..."
                  }
                  value={selectedNote}
                  onChange={(value) =>
                    setNotes((current) => ({
                      ...current,
                      [isBulkMode ? BULK_SELECTION_KEY : selectedItem.row.id]: value,
                    }))
                  }
                />
              </div>

              <ActieFoutmelding melding={actionError} />
            </>
          )}
        </ActionPanel>
      </AppShellPortal>

      <AppShellPortal slot="shortcut">
        <ShortcutPane
          shortcuts={[
            { keyLabel: "A", label: "Vorige" },
            { keyLabel: "D", label: "Volgende" },
            { keyLabel: "W", label: "Actie uitvoeren" },
            { keyLabel: "T", label: "Retour" },
            { keyLabel: "Y", label: "Akkoord" },
          ]}
        />
      </AppShellPortal>

      <ReviewRecordPanel
        record={selectedItem?.row}
        context={selectedItem?.context}
        currentIndex={selectedIndex >= 0 ? lijst.pagina * PAGINA_GROOTTE + selectedIndex + 1 : 0}
        totalCount={lijst.server.totaal}
        activeStep="ACCORDERING_ARCH"
        showRecordSections={false}
        summaryStats={summaryStats}
        reviewTableRows={reviewTableRows}
        selectedTableIds={selectedTableIds}
        onSelectedTableIdsChange={setSelectedTableIds}
        activeRecordId={selectedItem?.row.id ?? null}
        onActiveRecordChange={setSelectedId}
        sortKey={lijst.sortKey}
        sortDirection={lijst.sortDirection}
        onSortChange={lijst.zetSortering}
        server={lijst.server}
        enableCrossPageBulkSelection
        onPrevious={naarVorige}
        onNext={naarVolgende}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={hasRetour ? "Retour naar recordmanager?" : "Vrijgeven?"}
        description={
          hasRetour
            ? "Je rondt de archivaris-accordering af en zet de lijst terug naar de recordmanager voor herbeoordeling."
            : "Je bevestigt hiermee dat de archivistische accordering gereed is en dat de lijst vrijgegeven wordt voor vernietigingsopdracht."
        }
        confirmLabel={hasRetour ? "Ja, retour sturen" : "Ja, vrijgeven"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          void handleSubmitDecision();
        }}
      />
    </>
  );
}
