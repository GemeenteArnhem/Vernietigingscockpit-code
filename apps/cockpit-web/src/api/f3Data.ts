import type {
  DashboardTaskRecord,
  DashboardWorkflowStepId,
  TaskExecutionStatus,
} from "../shared/types/dashboard";
import type {
  TaskExecutionConnector,
  TaskExecutionConnectorSelectionStatus,
  TaskExecutionDestructionConnector,
  TaskExecutionConnectorDestructionStatus,
} from "../shared/types/taskExecutionConnector";
import type { VernietigingsKandidaat } from "../shared/types/destruction";
import type { ReviewDecision, ReviewRecordContext } from "../shared/types/review";
import type {
  DestructionResultContext,
  DestructionResultRow,
  DestructionResultStatus,
} from "../shared/types/destructionResult";
import type {
  TaskExecutionHeaderMetaItem,
  TaskExecutionHeaderSummaryStats,
} from "../features/task-execution/components/TaskExecutionHeader";
import type {
  TaskDefinitionExecutionStatus,
  TaskDefinitionInstance,
  TaskDefinitionRecord,
} from "../shared/types/taskDefinition";
import type {
  AccorderingBesluitInvoer,
  ApiArchivering,
  ApiArchiveringStand,
  ApiBijgewerkt,
  ApiGedeeld,
  ApiKandidaat,
  ApiKandidaatAccordering,
  ApiKandidaatBeoordeling,
  ApiKandidaatIds,
  ApiKandidatenPagina,
  ApiSelectieSamenvatting,
  ApiSelectieStekker,
  ApiStamgegevensMedewerker,
  ApiStekkerOptie,
  ApiTaakSelectie,
  ApiTaakStatus,
  ApiTaakdefinitie,
  ApiTaakinstantie,
  ApiUitvoering,
  ApiUitvoeringStekker,
  ApiVerklaring,
  ApiVernietigingsopdracht,
  ApiVernietigingsresultaat,
  ApiVernietigingsresultaten,
  KandidaatBeoordelingInvoer,
  KandidatenSortering,
  KandidatenStatusFilter,
  KandidatenZoekIn,
  TaakdefinitieInvoer,
} from "@vernietigingscockpit/api-contract";
import { apiDownload, apiRequest } from "./apiClient";

// Antwoord- en invoertypes komen uit het gedeelde contract met de API (CC-19).
export type { ApiArchivering };
export type StamgegevensMedewerker = ApiStamgegevensMedewerker;
export type StekkerOption = ApiStekkerOptie;
export type CreateTaskDefinitionInput = TaakdefinitieInvoer;
export type UpdateKandidaatBeoordelingInput = KandidaatBeoordelingInvoer;
export type UpdateProceseigenaarAccorderingInput = AccorderingBesluitInvoer;

export async function getDashboardTasks(
  accessToken: string,
  scope: "mijn" | "alle" = "mijn"
) {
  const taken = await apiRequest<ApiTaakinstantie[]>(`/taken?scope=${scope}`, {
    accessToken,
  });

  return taken.map(mapTaakToDashboardRecord);
}

// Beheerder en auditor zien alle taken ('alle'); anderen hun eigen ('mijn').
export async function getTaskDefinitions(accessToken: string, scope: "mijn" | "alle" = "mijn") {
  const definitions = await apiRequest<ApiTaakdefinitie[]>(
    `/taakdefinities?scope=${scope}`,
    {
      accessToken,
    }
  );

  return definitions.map(mapTaakdefinitie);
}

// Verwijderen door de functioneel beheerder (logisch als er een auditketen is).
export async function verwijderTaakdefinitie(accessToken: string, taskDefinitionId: string) {
  return apiRequest<void>(`/taakdefinities/${taskDefinitionId}`, { accessToken, method: "DELETE" });
}

export async function verwijderTaakuitvoering(accessToken: string, taskDefinitionId: string, taskInstanceId: string) {
  return apiRequest<void>(`/taakdefinities/${taskDefinitionId}/instanties/${taskInstanceId}`, {
    accessToken,
    method: "DELETE",
  });
}

export async function createTaskInstance(
  accessToken: string,
  taskDefinitionId: string
) {
  const instantie = await apiRequest<ApiTaakinstantie>(
    `/taakdefinities/${taskDefinitionId}/instanties`,
    {
      accessToken,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  return mapTaakinstantieToDefinitionInstance(instantie, 0);
}

export async function getMedewerkers(
  accessToken: string,
  rol: "recordmanager" | "proceseigenaar" | "archivaris"
) {
  return apiRequest<StamgegevensMedewerker[]>(
    `/stamgegevens/medewerkers?rol=${rol}`,
    {
      accessToken,
    }
  );
}

export async function getStekkers(accessToken: string) {
  return apiRequest<StekkerOption[]>("/stekkers", {
    accessToken,
  });
}

export async function createTaskDefinition(
  accessToken: string,
  input: CreateTaskDefinitionInput
) {
  const definition = await apiRequest<ApiTaakdefinitie>("/taakdefinities", {
    accessToken,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return mapTaakdefinitie(definition);
}

export async function getTaskSelection(accessToken: string, taskInstanceId: string) {
  const selectie = await apiRequest<ApiTaakSelectie>(
    `/taken/${taskInstanceId}/selectie`,
    {
      accessToken,
    }
  );

  return mapTaskSelection(selectie);
}

export async function startTaskSelection(
  accessToken: string,
  taskInstanceId: string,
  input: { peildatum?: string | null; stekkerId?: string | null } = {}
) {
  const selectie = await apiRequest<ApiTaakSelectie>(
    `/taken/${taskInstanceId}/selectie`,
    {
      accessToken,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  return mapTaskSelection(selectie);
}

// Zoekvraag voor de kandidatenlijst; de waarden volgen het invoerschema van de API.
export type KandidatenLijstQuery = {
  offset: number;
  limit: number;
  zoek?: string;
  zoekIn?: KandidatenZoekIn;
  status?: KandidatenStatusFilter;
  ids?: string[];
  selectielijst?: string;
  stekker?: string;
  bewaartermijn?: string;
  sort?: KandidatenSortering;
  richting?: "asc" | "desc";
};

function kandidatenQueryString(query: KandidatenLijstQuery) {
  const parameters = new URLSearchParams();

  for (const [sleutel, waarde] of Object.entries(query)) {
    if (waarde === undefined || waarde === "") {
      continue;
    }

    parameters.set(sleutel, Array.isArray(waarde) ? waarde.join(",") : String(waarde));
  }

  return parameters.toString();
}

// Eén pagina van de kandidatenlijst (CC-10), in dezelfde vorm als de schermen gewend zijn.
export async function getReviewCandidatesPagina(
  accessToken: string,
  taskInstanceId: string,
  query: KandidatenLijstQuery
) {
  const response = await apiRequest<ApiKandidatenPagina>(
    `/taken/${taskInstanceId}/kandidaten?${kandidatenQueryString(query)}`,
    {
      accessToken,
    }
  );

  return {
    taakVersie: response.taak.versie,
    pagina: response.pagina,
    tellingen: response.tellingen,
    facetten: response.facetten,
    rows: response.kandidaten.map(mapReviewCandidate),
    contexts: response.kandidaten.map((candidate) =>
      mapReviewContext(candidate, response.taak)
    ),
    decisions: Object.fromEntries(
      response.kandidaten.map((candidate) => [
        candidate.id,
        mapApiBeoordelingToDecision(candidate.beoordeling),
      ])
    ) as Record<string, ReviewDecision>,
    volgnummers: Object.fromEntries(
      response.kandidaten.map((candidate) => [candidate.id, candidate.volgnummer])
    ) as Record<string, number>,
  };
}

// Alle kandidaat-id's die aan dezelfde zoekopdracht en filters voldoen.
export async function getReviewCandidateIds(
  accessToken: string,
  taskInstanceId: string,
  query: Omit<KandidatenLijstQuery, "offset" | "limit">
) {
  const response = await apiRequest<ApiKandidaatIds>(
    `/taken/${taskInstanceId}/kandidaten/ids?${kandidatenQueryString({ ...query, offset: 0, limit: 1 })}`,
    { accessToken }
  );

  return response.ids;
}

// Samenvatting van een (bulk)selectie, al opgemaakt zoals het detailpaneel waarden toont.
export async function getReviewSelectionSummary(
  accessToken: string,
  taskInstanceId: string,
  ids: string[]
) {
  const samenvatting = await apiRequest<ApiSelectieSamenvatting>(
    `/taken/${taskInstanceId}/kandidaten/samenvatting`,
    {
      accessToken,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }
  );
  const gedeeld = <T,>(veld: ApiGedeeld<T>, meerdere: string, opmaak: (waarde: T) => string) =>
    veld.verschillend ? meerdere : veld.waarde === null ? "-" : opmaak(veld.waarde);

  return {
    aantal: samenvatting.aantal,
    code: gedeeld(samenvatting.code, "Meerdere codes", (waarde) => waarde),
    selectielijst: gedeeld(samenvatting.selectielijst, "Meerdere selectielijsten", (waarde) => waarde),
    grondslag: gedeeld(samenvatting.grondslag, "Meerdere grondslagen", (waarde) => waarde),
    bewaartermijn: gedeeld(samenvatting.bewaartermijn, "Meerdere termijnen", (waarde) => `${parseRetentionYears(waarde)} jaar`),
    stekker: gedeeld(samenvatting.stekker, "Meerdere stekkers", (waarde) => waarde),
    periode: gedeeld(
      samenvatting.periode,
      "Meerdere periodes",
      ([van, tot]) => `${formatMonthYear(van)} / ${formatMonthYear(tot)}`
    ),
    vernietigingsdatum: samenvatting.vernietigingsdatum.van
      ? `${formatYearMonth(samenvatting.vernietigingsdatum.van)} t/m ${formatYearMonth(samenvatting.vernietigingsdatum.tot)}`
      : "-",
    volgnummer:
      samenvatting.volgnummer.van !== null
        ? `${samenvatting.volgnummer.van} t/m ${samenvatting.volgnummer.tot}`
        : "-",
    beslissingen: samenvatting.statussen.map(mapApiBeoordelingToDecision),
    aantalObjecten: samenvatting.aantalObjecten,
    aantalBetrokkenen: samenvatting.aantalBetrokkenen,
  };
}

export type SelectieSamenvatting = Awaited<ReturnType<typeof getReviewSelectionSummary>>;

// Weergave van een bewaartermijn zoals in de tabel ("7 jaar"), voor de filterkeuzes.
export function formatBewaartermijnLabel(value: string) {
  return `${parseRetentionYears(value)} jaar`;
}

// Bulkbesluiten (CC-10): één verzoek voor de hele selectie, met de taakversie (If-Match).
export async function bulkKandidaatBeoordeling(
  accessToken: string,
  taskInstanceId: string,
  taakVersie: number,
  ids: string[],
  input: UpdateKandidaatBeoordelingInput
) {
  return apiRequest<ApiBijgewerkt>(`/taken/${taskInstanceId}/kandidaten`, {
    accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ifMatch(taakVersie) },
    body: JSON.stringify({ ...input, ids }),
  });
}

export async function bulkAccordering(
  accessToken: string,
  taskInstanceId: string,
  taakVersie: number,
  ids: string[],
  input: UpdateProceseigenaarAccorderingInput,
  rol: "proceseigenaar" | "archivaris"
) {
  return apiRequest<ApiBijgewerkt>(`/taken/${taskInstanceId}/kandidaten/accordering/${rol}`, {
    accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ifMatch(taakVersie) },
    body: JSON.stringify({ ...input, ids }),
  });
}

export async function getDestructionResults(
  accessToken: string,
  taskInstanceId: string
) {
  const response = await apiRequest<ApiVernietigingsresultaten>(
    `/taken/${taskInstanceId}/vernietigingsresultaten`,
    {
      accessToken,
    }
  );
  const rows = response.resultaten.map(mapDestructionResult);

  return {
    taak: response.taak,
    rows,
    contexts: response.resultaten.map((result) =>
      mapDestructionResultContext(result, response.taak)
    ),
    metaItems: mapResultMetaItems(response.taak),
    summaryStats: mapResultSummaryStats(rows),
  };
}

export async function retryVernietiging(
  accessToken: string,
  taskInstanceId: string,
  stekkerId: string
) {
  await apiRequest(`/taken/${taskInstanceId}/uitvoering/${stekkerId}/opnieuw`, {
    method: "POST",
    accessToken,
  });
}

export async function getDestructionExecution(
  accessToken: string,
  taskInstanceId: string
) {
  const response = await apiRequest<ApiUitvoering>(
    `/taken/${taskInstanceId}/uitvoering`,
    {
      accessToken,
    }
  );
  const connectors = response.stekkers.map(mapDestructionExecutionConnector);

  return {
    taak: response.taak,
    connectors,
    // Voor de bevestiging vóór de vernietigingsopdracht: wat er per stekker wordt aangeboden.
    opdrachtOverzicht: response.stekkers
      .filter((stekker) => stekker.aantalKandidaten > 0)
      .map((stekker) => ({
        naam: stekker.naam,
        aantalKandidaten: stekker.aantalKandidaten,
        aantalBatches: Math.ceil(stekker.aantalKandidaten / (stekker.batchGrootte ?? 100)),
      })),
    metaItems: mapResultMetaItems(response.taak),
    summaryStats: {
      teBeoordelen: connectors.filter(
        (connector) => connector.vernietigingsStatus === "BEZIG"
      ).length,
      akkoord: connectors.filter(
        (connector) => connector.vernietigingsStatus === "VOLTOOID"
      ).length,
      retour: connectors.filter(
        (connector) => connector.vernietigingsStatus === "GEDEELTELIJK_VOLTOOID"
      ).length,
      uitgesloten: connectors.filter(
        (connector) => connector.vernietigingsStatus === "NIET_GESTART"
      ).length,
    },
  };
}

export async function getVernietigingsverklaring(
  accessToken: string,
  taskInstanceId: string
) {
  return apiRequest<ApiVerklaring>(
    `/taken/${taskInstanceId}/verklaring`,
    {
      accessToken,
    }
  );
}

// Archiveren aanvragen (CC-18); de worker voert het uit.
export async function archiveerTaak(accessToken: string, taskInstanceId: string, taakVersie: number) {
  return apiRequest<ApiArchivering>(`/taken/${taskInstanceId}/archiveren`, {
    accessToken,
    method: "POST",
    headers: ifMatch(taakVersie),
  });
}

export async function getArchivering(accessToken: string, taskInstanceId: string) {
  return apiRequest<ApiArchiveringStand>(
    `/taken/${taskInstanceId}/archivering`,
    { accessToken }
  );
}

export async function downloadVernietigingsverklaringPdf(
  accessToken: string,
  taskInstanceId: string
) {
  return apiDownload(`/taken/${taskInstanceId}/verklaring.pdf`, {
    accessToken,
  });
}

export async function downloadVernietigingsresultatenCsv(
  accessToken: string,
  taskInstanceId: string
) {
  return apiDownload(`/taken/${taskInstanceId}/verklaring/bijlage.csv`, {
    accessToken,
  });
}

export async function updateKandidaatBeoordeling(
  accessToken: string,
  taskInstanceId: string,
  kandidaatId: string,
  input: UpdateKandidaatBeoordelingInput
) {
  return apiRequest<ApiKandidaatBeoordeling>(`/taken/${taskInstanceId}/kandidaten/${kandidaatId}/beoordeling`, {
    accessToken,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function submitBeoordelingVoorAccordering(
  accessToken: string,
  taskInstanceId: string,
  taakVersie: number
) {
  return apiRequest<ApiTaakStatus>(`/taken/${taskInstanceId}/beoordeling/voorleggen`, {
    accessToken,
    method: "POST",
    headers: ifMatch(taakVersie),
  });
}

export async function updateProceseigenaarAccordering(
  accessToken: string,
  taskInstanceId: string,
  kandidaatId: string,
  input: UpdateProceseigenaarAccorderingInput
) {
  return apiRequest<ApiKandidaatAccordering>(
    `/taken/${taskInstanceId}/kandidaten/${kandidaatId}/accordering/proceseigenaar`,
    {
      accessToken,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );
}

export async function submitProceseigenaarAccordering(
  accessToken: string,
  taskInstanceId: string,
  taakVersie: number
) {
  return apiRequest<ApiTaakStatus>(`/taken/${taskInstanceId}/accordering/proceseigenaar/besluiten`, {
    accessToken,
    method: "POST",
    headers: ifMatch(taakVersie),
  });
}

export async function updateArchivarisAccordering(
  accessToken: string,
  taskInstanceId: string,
  kandidaatId: string,
  input: UpdateProceseigenaarAccorderingInput
) {
  return apiRequest<ApiKandidaatAccordering>(
    `/taken/${taskInstanceId}/kandidaten/${kandidaatId}/accordering/archivaris`,
    {
      accessToken,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );
}

export async function submitArchivarisAccordering(
  accessToken: string,
  taskInstanceId: string,
  taakVersie: number
) {
  return apiRequest<ApiTaakStatus>(`/taken/${taskInstanceId}/accordering/archivaris/besluiten`, {
    accessToken,
    method: "POST",
    headers: ifMatch(taakVersie),
  });
}

export async function startVernietigingsopdracht(
  accessToken: string,
  taskInstanceId: string,
  taakVersie: number
) {
  return apiRequest<ApiVernietigingsopdracht>(`/taken/${taskInstanceId}/vernietigingsopdracht`, {
    accessToken,
    method: "POST",
    headers: ifMatch(taakVersie),
  });
}

// Statuswijzigingen sturen de geladen taakversie mee. Is de taak intussen gewijzigd,
// dan weigert de API (412) en moet de pagina opnieuw geladen worden.
function ifMatch(taakVersie: number) {
  return { "If-Match": `"${taakVersie}"` };
}

function mapTaakToDashboardRecord(taak: ApiTaakinstantie): DashboardTaskRecord {
  const status = mapExecutionStatus(taak.status, taak.stapSinds, taak.geplandOp);
  const stapId = mapStepId(taak.status);
  const startdatum = formatDate(taak.gestartOp ?? taak.peildatum);

  return {
    id: taak.id,
    taakdefinitieId: taak.taakdefinitie?.id,
    taakdefinitieNaam: taak.taakdefinitie?.naam,
    naam: taak.naam,
    subtitle: taak.gestartOp
      ? `Gestart ${startdatum}`
      : `Peildatum ${startdatum}`,
    status,
    eigenaar: "mijn",
    stapId,
    stap: mapStepLabel(taak.status),
    voortgang: mapProgress(taak.status),
    dagenInStap: daysSince(taak.stapSinds),
    recordmanager: taak.verantwoordelijken.recordmanager.naam,
    proceseigenaar: taak.verantwoordelijken.proceseigenaar.naam,
    archivaris: taak.verantwoordelijken.archivaris.naam,
    startdatum,
    frequentie: formatFrequency(taak.taakdefinitie?.frequentie ?? ""),
    dossierTelling: taak.tellingen.totaalKandidaten,
    toegestaneActies: taak.toegestaneActies ?? [],
  };
}

function mapTaakdefinitie(definition: ApiTaakdefinitie): TaskDefinitionRecord {
  return {
    id: definition.id,
    naam: definition.naam,
    subtitle: definition.omschrijving ?? definition.categorie,
    categorie: definition.categorie,
    frequentie: formatFrequency(definition.frequentie),
    proceseigenaar: definition.verantwoordelijken.proceseigenaar.naam,
    archivaris: definition.verantwoordelijken.archivaris.naam,
    instanties: (definition.instanties ?? []).map((instantie, index) =>
      mapTaakinstantieToDefinitionInstance(instantie, index)
    ),
    stekkers: definition.stekkers.map((stekker) => ({
      id: stekker.id,
      naam: stekker.naam,
      type: "Stekker",
      omschrijving: stekker.omschrijving ?? undefined,
      status: "SUCCES",
    })),
    toegestaneActies: definition.toegestaneActies ?? [],
  };
}

function mapTaakinstantieToDefinitionInstance(
  instantie: ApiTaakinstantie,
  index: number
): TaskDefinitionInstance {
  return {
    id: instantie.id,
    naam: instantie.naam,
    subtitle: instantie.gestartOp
      ? `Gestart ${formatDate(instantie.gestartOp)}`
      : `Peildatum ${formatDate(instantie.peildatum)}`,
    startdatum: formatDate(instantie.gestartOp ?? instantie.peildatum),
    recordmanager: instantie.verantwoordelijken.recordmanager.naam,
    status: mapDefinitionStatus(instantie.status, instantie.stapSinds, instantie.geplandOp),
    stap: mapStepLabel(instantie.status),
    voortgang: mapProgress(instantie.status),
    plannedStartDate: instantie.peildatum ?? undefined,
    highlighted: index === 0,
    toegestaneActies: instantie.toegestaneActies ?? [],
  };
}

function mapTaskSelection(selectie: ApiTaakSelectie) {
  const connectors: TaskExecutionConnector[] = selectie.stekkers.map((item) => {
    const selectionStatus = mapSelectionStatus(item.selectie?.status);
    const imported = item.selectie?.geimporteerd ?? 0;
    const total = item.selectie?.totaalKandidaten ?? 0;

    return {
      id: item.stekker.id,
      naam: item.stekker.naam,
      versie: item.configuratie ? `v${item.configuratie.versie}` : "-",
      stekkerStatus: item.selectie?.fout ? "FOUT" : "SUCCES",
      selectieStatus: selectionStatus,
      voortgang: mapSelectionProgress(selectionStatus, imported, total),
      laatsteRun: item.selectie?.selectietijdstip
        ? formatDateTime(item.selectie.selectietijdstip)
        : "Nog niet uitgevoerd",
      aantalObjecten:
        typeof item.selectie?.totaalObjecten === "number" &&
        item.selectie.totaalObjecten > 0
          ? `${item.selectie.totaalObjecten.toLocaleString("nl-NL")} objecten`
          : "-",
      melding: mapSelectionMessage(item),
    };
  });

  return {
    taak: selectie.taak,
    connectors,
    summaryStats: {
      teBeoordelen: connectors.filter(
        (connector) =>
          connector.selectieStatus === "NIET_GESTART" ||
          connector.selectieStatus === "BEZIG"
      ).length,
      akkoord: connectors.filter(
        (connector) => connector.selectieStatus === "VOLTOOID"
      ).length,
      retour: connectors.filter(
        (connector) => connector.selectieStatus === "GEDEELTELIJK_VOLTOOID"
      ).length,
      uitgesloten: 0,
    },
  };
}

function mapReviewCandidate(candidate: ApiKandidaat): VernietigingsKandidaat {
  return {
    id: candidate.id,
    titel: candidate.omschrijving,
    omvang: candidate.aantalObjecten,
    aantalObjecten: candidate.aantalObjecten,
    aantalBetrokkenen: candidate.aantalBetrokkenen,
    bewaartermijn: parseRetentionYears(candidate.bewaartermijn),
    vernietigingsdatum: formatYearMonth(candidate.vernietigingsdatum),
    uitgesloten: candidate.beoordeling === "UITGESLOTEN",
    reden: candidate.uitsluitReden ?? undefined,
    toelichting: candidate.toelichting ?? undefined,
    beoordeling: mapApiBeoordeling(candidate.beoordeling),
    bron_id: candidate.bronId,
    code: candidate.classificatiesleutel ?? undefined,
    startdatum: formatMonthYear(candidate.begindatum),
    einddatum: formatMonthYear(candidate.einddatum),
    selectielijst: candidate.selectielijst ?? undefined,
    grondslag: candidate.grondslag ?? undefined,
    bron_systeem: candidate.stekker.naam,
  };
}

function mapReviewContext(
  candidate: ApiKandidaat,
  task: ApiKandidatenPagina["taak"]
): ReviewRecordContext {
  return {
    recordId: candidate.id,
    proces: task.naam,
    recordmanager: task.verantwoordelijken.recordmanager.naam,
    proceseigenaar: task.verantwoordelijken.proceseigenaar.naam,
    archivaris: task.verantwoordelijken.archivaris.naam,
    startdatumTaak: formatDate(task.stapSinds),
    vernietigbaarSinds: formatYearMonth(candidate.vernietigingsdatum),
    risiconiveau: "laag",
    queueStatus:
      candidate.beoordeling === "UITGESLOTEN"
        ? "conflict"
        : candidate.beoordeling === "AKKOORD"
          ? "afgerond"
          : candidate.beoordeling === "RETOUR"
            ? "retour"
          : "nog-te-beoordelen",
    beoordelingsRedenen: [
      candidate.grondslag ?? "Selectie uit stekker",
      candidate.bewaartermijn
        ? `Bewaartermijn ${candidate.bewaartermijn}`
        : "Bewaartermijn uit bron",
    ],
    workflow: [
      {
        actor: "Cockpit",
        detail: "Kandidaat geimporteerd uit stekkerselectie",
        state: "done",
        timestamp: formatDate(task.stapSinds),
      },
      {
        actor: task.verantwoordelijken.recordmanager.naam,
        detail: "Beoordeling open",
        state: "active",
      },
    ],
    comments: candidate.toelichting
      ? [
          {
            author: "Cockpit",
            role: "Import",
            message: candidate.toelichting,
            timestamp: formatDate(task.stapSinds),
          },
        ]
      : [],
  };
}

function mapDestructionResult(result: ApiVernietigingsresultaat): DestructionResultRow {
  return {
    id: result.id,
    titel: result.omschrijving,
    stekker: result.stekker.naam,
    vernietigingsstatus: mapDestructionStatus(result.vernietigingsstatus),
    omvang: result.aantalObjecten,
    aantalBetrokkenen: result.aantalBetrokkenen,
    bewaartermijn: parseRetentionYears(result.bewaartermijn),
    vernietigingsdatum: formatYearMonth(result.vernietigingsdatum),
    bron_id: result.bronId,
    code: result.classificatiesleutel ?? undefined,
    startdatum: formatMonthYear(result.begindatum),
    einddatum: formatMonthYear(result.einddatum),
    selectielijst: result.selectielijst ?? undefined,
    grondslag: result.grondslag ?? undefined,
    bron_systeem: result.stekker.naam,
    melding: result.foutmelding ?? result.bronstatus ?? result.logReference ?? undefined,
  };
}

function mapDestructionExecutionConnector(
  item: ApiUitvoeringStekker
): TaskExecutionDestructionConnector {
  const destructionStatus = mapExecutionDestructionStatus(
    item.vernietigingStatus,
    item.externVernietigingId
  );
  const completed =
    item.resultaatTellingen.success +
    item.resultaatTellingen.failed +
    item.resultaatTellingen.notFound +
    item.resultaatTellingen.skipped +
    item.resultaatTellingen.changed;

  return {
    id: item.id,
    naam: item.naam,
    versie: item.versie ? `v${item.versie}` : "-",
    stekkerStatus: item.stekkerStatus === "FOUT" ? "FOUT" : "SUCCES",
    vernietigingsStatus: destructionStatus,
    voortgang: mapDestructionExecutionProgress(
      destructionStatus,
      completed,
      item.aantalKandidaten
    ),
    laatsteRun: (item.vernietigingAfgerondOp ?? item.vernietigingGestartOp)
      ? formatDateTime(
          item.vernietigingAfgerondOp ?? item.vernietigingGestartOp ?? ""
        )
      : "Nog niet uitgevoerd",
    aantalObjecten:
      item.aantalObjecten > 0
        ? `${item.aantalObjecten.toLocaleString("nl-NL")} objecten`
        : `${item.aantalKandidaten.toLocaleString("nl-NL")} kandidaten`,
    melding: mapDestructionExecutionMessage(item, destructionStatus),
    toegestaneActies: item.toegestaneActies ?? [],
  };
}

function mapDestructionResultContext(
  result: ApiVernietigingsresultaat,
  task: ApiVernietigingsresultaten["taak"]
): DestructionResultContext {
  const status = mapDestructionStatus(result.vernietigingsstatus);

  return {
    recordId: result.id,
    recordmanager: task.verantwoordelijken.recordmanager.naam,
    proceseigenaar: task.verantwoordelijken.proceseigenaar.naam,
    archivaris: task.verantwoordelijken.archivaris.naam,
    startdatumTaak: formatDate(task.stapSinds),
    bronSysteem: result.stekker.naam,
    omvangLabel: `${result.aantalObjecten} ${
      result.aantalObjecten === 1 ? "object" : "objecten"
    }`,
    statusDetail: getDestructionStatusDetail(status),
    vervolgstap: getDestructionNextStep(status),
    comments: [
      {
        author: result.stekker.naam,
        role: "Stekker",
        message:
          result.foutmelding ??
          result.logReference ??
          "Vernietigingsresultaat verwerkt.",
        timestamp: formatDate(task.stapSinds),
      },
    ],
  };
}

function mapResultMetaItems(
  task: ApiVernietigingsresultaten["taak"]
): TaskExecutionHeaderMetaItem[] {
  return [
    { label: "Recordmanager", value: task.verantwoordelijken.recordmanager.naam },
    { label: "Proceseigenaar", value: task.verantwoordelijken.proceseigenaar.naam },
    { label: "Archivaris", value: task.verantwoordelijken.archivaris.naam },
    { label: "Startdatum", value: formatDate(task.stapSinds) },
  ];
}

function mapResultSummaryStats(
  rows: DestructionResultRow[]
): TaskExecutionHeaderSummaryStats {
  return {
    teBeoordelen: rows.filter((row) => row.vernietigingsstatus === "FAILED").length,
    akkoord: rows.filter((row) => row.vernietigingsstatus === "SUCCESS").length,
    retour: rows.filter((row) => row.vernietigingsstatus === "NOT_FOUND").length,
    uitgesloten: rows.filter((row) => row.vernietigingsstatus === "SKIPPED").length,
  };
}

function mapDestructionStatus(value: string | null): DestructionResultStatus {
  if (
    value === "SUCCESS" ||
    value === "FAILED" ||
    value === "NOT_FOUND" ||
    value === "SKIPPED" ||
    value === "CHANGED"
  ) {
    return value;
  }

  return "SKIPPED";
}

function getDestructionStatusDetail(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCESS":
      return "Record is verwijderd in het bronsysteem en verwerkt in het auditspoor.";
    case "FAILED":
      return "Uitvoering is gestopt door een technische fout of autorisatieprobleem.";
    case "NOT_FOUND":
      return "Bronrecord was niet meer aanwezig tijdens de vernietigingsactie.";
    case "CHANGED":
      return "Bronrecord is gewijzigd sinds de selectie en vraagt om opvolging.";
    default:
      return "Record is overgeslagen en vraagt om aanvullende opvolging.";
  }
}

function getDestructionNextStep(status: DestructionResultStatus) {
  switch (status) {
    case "SUCCESS":
      return "Opnemen in de verklaring en gereedmaken voor archivering.";
    case "FAILED":
      return "Herstelactie plannen en de connectoruitvoer opnieuw beoordelen.";
    case "NOT_FOUND":
      return "Vastleggen als niet gevonden en controleren of bronmutatie is verwacht.";
    case "CHANGED":
      return "Vastleggen als gewijzigd en bepalen of een vervolgtaak nodig is.";
    default:
      return "Afstemmen met recordmanager of dit record opnieuw moet worden aangeboden.";
  }
}

function mapExecutionDestructionStatus(
  status?: string | null,
  externVernietigingId?: string | null
): TaskExecutionConnectorDestructionStatus {
  switch (status) {
    case "COMPLETED":
      return "VOLTOOID";
    case "PARTIAL":
    case "FAILED":
      return "GEDEELTELIJK_VOLTOOID";
    case "IDLE":
    case "RUNNING":
      return "BEZIG";
    default:
      return externVernietigingId ? "BEZIG" : "NIET_GESTART";
  }
}

function mapDestructionExecutionProgress(
  status: TaskExecutionConnectorDestructionStatus,
  completed: number,
  total: number
) {
  if (status === "VOLTOOID") {
    return 100;
  }

  if (status === "NIET_GESTART") {
    return 0;
  }

  if (total > 0 && completed > 0) {
    return Math.max(1, Math.min(100, Math.round((completed / total) * 100)));
  }

  return status === "BEZIG" ? 35 : 100;
}

function mapDestructionExecutionMessage(
  item: ApiUitvoeringStekker,
  status: TaskExecutionConnectorDestructionStatus
) {
  if (item.fout) {
    return item.fout;
  }

  switch (status) {
    case "VOLTOOID":
      return "De vernietiging is afgerond en de resultaten zijn opgehaald.";
    case "GEDEELTELIJK_VOLTOOID":
      return "De vernietiging is afgerond met afwijkingen. Controleer de resultaten.";
    case "BEZIG":
      return item.externVernietigingId
        ? "De stekker verwerkt de vernietigingsopdracht."
        : "De vernietigingsopdracht staat klaar voor de worker.";
    case "NIET_GESTART":
      return "De vernietigingsopdracht is nog niet gestart voor deze stekker.";
  }
}

function mapApiBeoordeling(value: string): VernietigingsKandidaat["beoordeling"] {
  if (
    value === "OPGENOMEN" ||
    value === "AKKOORD" ||
    value === "UITGESLOTEN" ||
    value === "RETOUR"
  ) {
    return value;
  }

  return "OPGENOMEN";
}

function mapApiBeoordelingToDecision(value: string): ReviewDecision {
  switch (value) {
    case "AKKOORD":
      return "akkoord";
    case "UITGESLOTEN":
      return "uitsluiten";
    case "RETOUR":
      return "retour";
    default:
      return "open";
  }
}

function parseRetentionYears(value?: string | null) {
  if (!value) {
    return 0;
  }

  const match = value.match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function formatYearMonth(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 7);
}

function formatMonthYear(value?: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month] = value.slice(0, 10).split("-");

  return month && year ? `${month}-${year}` : value;
}

function mapSelectionStatus(
  status?: string | null
): TaskExecutionConnectorSelectionStatus {
  switch (status) {
    case "GEIMPORTEERD":
    case "READY":
      return "VOLTOOID";
    case "FAILED":
      return "GEDEELTELIJK_VOLTOOID";
    case "AANGEVRAAGD":
    case "RUNNING":
      return "BEZIG";
    default:
      return "NIET_GESTART";
  }
}

function mapSelectionProgress(
  status: TaskExecutionConnectorSelectionStatus,
  imported: number,
  total: number
) {
  if (status === "VOLTOOID") {
    return 100;
  }

  if (status === "NIET_GESTART") {
    return 0;
  }

  if (total > 0) {
    return Math.round((imported / total) * 100);
  }

  return status === "BEZIG" ? 10 : 20;
}

function mapSelectionMessage(item: ApiSelectieStekker) {
  if (!item.selectie) {
    return "De selectie is nog niet gestart voor deze stekker.";
  }

  if (item.selectie.fout) {
    return item.selectie.fout;
  }

  switch (item.selectie.status) {
    case "AANGEVRAAGD":
      return "Selectie-aanvraag staat klaar voor de worker.";
    case "RUNNING":
      return "De stekker is bezig met de selectie.";
    case "READY":
      return "De stekker heeft resultaten klaarstaan voor import.";
    case "GEIMPORTEERD":
      return "De snapshot is opgehaald en klaar voor beoordeling.";
    default:
      return "Selectiestatus ontvangen van de cockpit.";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Een geplande uitvoering (terugkerende taak) is 'Gepland' tot de startdatum; de termijn
// voor 'Vertraagd' telt pas vanaf die datum.
function mapExecutionStatus(
  status: string,
  stepSince: string,
  geplandOp?: string | null
): TaskExecutionStatus {
  if (status === "init" && geplandOp && new Date(geplandOp).getTime() > Date.now()) {
    return "GEPLAND";
  }

  const sinds =
    status === "init" && geplandOp && new Date(geplandOp).getTime() > new Date(stepSince).getTime()
      ? geplandOp
      : stepSince;

  if (daysSince(sinds) > 7) {
    return "VERTRAAGD";
  }

  return status === "init" ? "GEPLAND" : "LOPEND";
}

function mapDefinitionStatus(
  status: string,
  stepSince: string,
  geplandOp?: string | null
): TaskDefinitionExecutionStatus {
  if (status === "archief") {
    return "VOLTOOID";
  }

  return mapExecutionStatus(status, stepSince, geplandOp);
}

function mapStepId(status: string): DashboardWorkflowStepId {
  switch (status) {
    case "beoordeling":
      return "BEOORDELING";
    case "accordering_po":
      return "ACCORDERING_PO";
    case "accordering_archivaris":
      return "ACCORDERING_ARCH";
    case "vrijgegeven":
      return "UITVOERING";
    case "uitvoering":
      return "UITVOERING";
    case "resultaat":
    case "archief":
      return "RESULTAAT";
    default:
      return "SELECTIE";
  }
}

function mapStepLabel(status: string) {
  switch (status) {
    case "init":
      return "Selectie";
    case "beoordeling":
      return "Beoordeling";
    case "accordering_po":
      return "Accordering proceseigenaar";
    case "accordering_archivaris":
      return "Accordering archivaris";
    case "vrijgegeven":
      return "Vrijgegeven";
    case "uitvoering":
      return "Uitvoering";
    case "resultaat":
      return "Resultaat";
    case "archief":
      return "Archief";
    default:
      return status;
  }
}

function mapProgress(status: string) {
  const order = [
    "init",
    "beoordeling",
    "accordering_po",
    "accordering_archivaris",
    "vrijgegeven",
    "uitvoering",
    "resultaat",
    "archief",
  ];
  const index = Math.max(0, order.indexOf(status));

  return Math.round((index / (order.length - 1)) * 100);
}

function formatFrequency(frequency: string) {
  switch (frequency) {
    case "jaarlijks":
      return "Jaarlijks";
    case "kwartaal":
      return "Per kwartaal";
    case "maandelijks":
      return "Maandelijks";
    case "ad_hoc":
      return "Ad-hoc";
    default:
      return frequency || "Onbekend";
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Onbekend";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function daysSince(value: string) {
  const started = new Date(value).getTime();
  const diff = Date.now() - started;

  if (!Number.isFinite(diff) || diff < 0) {
    return 0;
  }

  return Math.floor(diff / 86_400_000);
}
