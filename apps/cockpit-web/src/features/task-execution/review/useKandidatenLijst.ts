import type { KandidatenStatusFilter } from "@vernietigingscockpit/api-contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatTermijnLooptijd,
  getReviewCandidateIds,
  getReviewCandidatesPagina,
  getReviewSelectionSummary,
  type KandidatenLijstQuery,
  type SelectieSamenvatting,
} from "../../../api/f3Data";
import type {
  FacetFilterKey,
  ReviewRecordSortDirection,
  ReviewRecordSortKey,
  SearchScope,
  ServerLijst,
} from "./components/ReviewRecordPanel";

// Gedeelde kandidatenlijst voor beoordeling en accordering (CC-10). De server pagineert,
// zoekt, filtert en sorteert; deze hook houdt de zoekopdracht bij en levert precies één
// pagina plus de tellingen over de hele lijst. "Uitgesteld" is een markering in de
// browser; dat filter stuurt de uitgestelde id's mee.

export const PAGINA_GROOTTE = 100;

type Pagina = Awaited<ReturnType<typeof getReviewCandidatesPagina>>;

const STATUS_LABELS: Record<string, string> = {
  "nog-te-beoordelen": "Te beoordelen",
  afgerond: "Akkoord",
  retour: "Retour",
  conflict: "Uitgesloten",
  uitgesteld: "Uitgesteld",
};

// Geen geldig kandidaat-id: een filter op "uitgesteld" zonder uitgestelde records is leeg.
const GEEN_KANDIDAAT = "00000000-0000-4000-8000-000000000000";

export function useKandidatenLijst({
  accessToken,
  taakId,
  uitgesteldeIds,
}: {
  accessToken?: string;
  taakId?: string;
  uitgesteldeIds: string[];
}) {
  const [pagina, setPagina] = useState(0);
  const [zoek, setZoek] = useState("");
  const [vertraagdeZoek, setVertraagdeZoek] = useState("");
  const [zoekIn, setZoekIn] = useState<SearchScope>("all");
  const [filters, setFilters] = useState<Partial<Record<FacetFilterKey, string>>>({});
  const [sortKey, setSortKey] = useState<ReviewRecordSortKey>("termijnEinddatum");
  const [sortDirection, setSortDirection] = useState<ReviewRecordSortDirection>("asc");
  const [data, setData] = useState<Pagina | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [verversing, setVerversing] = useState(0);

  // Niet bij elke toetsaanslag een verzoek: even wachten tot de gebruiker klaar is met typen.
  useEffect(() => {
    const timer = window.setTimeout(() => setVertraagdeZoek(zoek.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [zoek]);

  const filterQuery = useMemo<Omit<KandidatenLijstQuery, "offset" | "limit">>(() => {
    const uitgesteld = filters.status === "uitgesteld";

    return {
      zoek: vertraagdeZoek || undefined,
      zoekIn,
      // De statuskeuzes komen uit de facetten van de API.
      status: uitgesteld ? undefined : (filters.status as KandidatenStatusFilter | undefined),
      ids: uitgesteld ? (uitgesteldeIds.length > 0 ? uitgesteldeIds.slice(0, 200) : [GEEN_KANDIDAAT]) : undefined,
      selectielijst: filters.selectielijst,
      stekker: filters.stekker,
      termijnLooptijd: filters.termijnLooptijd,
      sort: sortKey,
      richting: sortDirection,
    };
  }, [filters, sortDirection, sortKey, uitgesteldeIds, vertraagdeZoek, zoekIn]);

  useEffect(() => {
    if (!accessToken || !taakId) {
      return;
    }

    let actueel = true;

    getReviewCandidatesPagina(accessToken, taakId, {
      ...filterQuery,
      offset: pagina * PAGINA_GROOTTE,
      limit: PAGINA_GROOTTE,
    })
      .then((resultaat) => {
        if (actueel) {
          setData(resultaat);
          setFout(null);
        }
      })
      .catch((error: unknown) => {
        if (actueel) {
          setFout(error instanceof Error ? error.message : "Kandidaten ophalen is mislukt.");
        }
      });

    return () => {
      actueel = false;
    };
  }, [accessToken, filterQuery, pagina, taakId, verversing]);

  const ververs = useCallback(() => setVerversing((teller) => teller + 1), []);

  const zetSortering = useCallback((key: ReviewRecordSortKey, richting: ReviewRecordSortDirection) => {
    setSortKey(key);
    setSortDirection(richting);
    setPagina(0);
  }, []);

  const gefilterdeIds = useCallback(
    () => (accessToken && taakId ? getReviewCandidateIds(accessToken, taakId, filterQuery) : Promise.resolve([])),
    [accessToken, filterQuery, taakId]
  );

  const totaalPaginas = Math.max(1, Math.ceil((data?.pagina.totaal ?? 0) / PAGINA_GROOTTE));

  const server = useMemo<ServerLijst>(
    () => ({
      totaal: data?.pagina.totaal ?? 0,
      pagina,
      paginaGrootte: PAGINA_GROOTTE,
      zoek,
      zoekIn,
      filters,
      facetOpties: {
        status: [...(data?.facetten.status ?? []), ...(uitgesteldeIds.length > 0 ? ["uitgesteld"] : [])].map((status) => ({
          waarde: status,
          label: STATUS_LABELS[status] ?? status,
        })),
        selectielijst: (data?.facetten.selectielijst ?? []).map((waarde) => ({ waarde, label: waarde })),
        stekker: (data?.facetten.stekker ?? []).map((waarde) => ({ waarde, label: waarde })),
        termijnLooptijd: (data?.facetten.termijnLooptijd ?? []).map((waarde) => ({
          waarde,
          label: formatTermijnLooptijd(waarde),
        })),
      },
      onPaginaChange: setPagina,
      onZoekChange: (volgendeZoek, volgendeScope) => {
        setZoek(volgendeZoek);
        setZoekIn(volgendeScope);
        setPagina(0);
      },
      onFiltersChange: (volgende) => {
        setFilters(volgende);
        setPagina(0);
      },
      gefilterdeIds,
    }),
    [data, filters, gefilterdeIds, pagina, uitgesteldeIds.length, zoek, zoekIn]
  );

  return {
    data,
    fout,
    server,
    pagina,
    heeftVolgendePagina: pagina < totaalPaginas - 1,
    heeftVorigePagina: pagina > 0,
    naarPagina: setPagina,
    sortKey,
    sortDirection,
    zetSortering,
    ververs,
  };
}

// Samenvatting van een bulkselectie die (deels) buiten de geladen pagina valt.
export function useSelectieSamenvatting(accessToken: string | undefined, taakId: string | undefined, ids: string[]) {
  const [samenvatting, setSamenvatting] = useState<SelectieSamenvatting | null>(null);
  const sleutel = ids.length > 1 ? ids.join(",") : "";

  useEffect(() => {
    if (!accessToken || !taakId || !sleutel) {
      return;
    }

    let actueel = true;
    const timer = window.setTimeout(() => {
      getReviewSelectionSummary(accessToken, taakId, sleutel.split(","))
        .then((resultaat) => {
          if (actueel) {
            setSamenvatting(resultaat);
          }
        })
        .catch(() => {
          if (actueel) {
            setSamenvatting(null);
          }
        });
    }, 200);

    return () => {
      actueel = false;
      window.clearTimeout(timer);
    };
  }, [accessToken, sleutel, taakId]);

  return sleutel && samenvatting?.aantal === ids.length ? samenvatting : null;
}
