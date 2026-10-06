import { ACTIEVE_SELECTIE } from "./actieve-selectie.js";

type SelectieStekkerRecord = {
  stekker: {
    id: string;
    naam: string;
    omschrijving: string | null;
    actief: boolean;
    configuraties: Array<{
      id: string;
      versie: number;
      baseUrl: string;
      verwachteApiMajor: number;
    }>;
  };
};

type SelectieRecord = {
  id: string;
  stekkerId: string;
  stekkerConfiguratieId: string;
  externSelectieId: string | null;
  status: string;
  peildatum: Date | null;
  selectietijdstip: Date | null;
  totaalKandidaten: number;
  totaalObjecten: number;
  totaalBetrokkenen: number;
  stekkerversie: string | null;
  configuratieversie: string | null;
  apiVersie: string | null;
  geimporteerd: number;
  fout: string | null;
  stekkerConfiguratie: {
    id: string;
    versie: number;
    baseUrl: string;
    verwachteApiMajor: number;
    stekker: {
      id: string;
      naam: string;
      omschrijving: string | null;
      actief: boolean;
    };
  };
};

type TaakSelectieRecord = {
  id: string;
  naam: string;
  status: string;
  peildatum: Date | null;
  taakdefinitie: {
    id: string;
    naam: string;
    stekkers: SelectieStekkerRecord[];
  };
  selecties: SelectieRecord[];
};

export const taakSelectieSelect = {
  id: true,
  naam: true,
  status: true,
  peildatum: true,
  taakdefinitie: {
    select: {
      id: true,
      naam: true,
      stekkers: {
        select: {
          stekker: {
            select: {
              id: true,
              naam: true,
              omschrijving: true,
              actief: true,
              configuraties: {
                select: {
                  id: true,
                  versie: true,
                  baseUrl: true,
                  verwachteApiMajor: true,
                },
                orderBy: {
                  versie: "desc",
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  },
  selecties: {
    where: ACTIEVE_SELECTIE,
    select: {
      id: true,
      stekkerId: true,
      stekkerConfiguratieId: true,
      externSelectieId: true,
      status: true,
      peildatum: true,
      selectietijdstip: true,
      totaalKandidaten: true,
      totaalObjecten: true,
      totaalBetrokkenen: true,
      stekkerversie: true,
      configuratieversie: true,
      apiVersie: true,
      geimporteerd: true,
      fout: true,
      stekkerConfiguratie: {
        select: {
          id: true,
          versie: true,
          baseUrl: true,
          verwachteApiMajor: true,
          stekker: {
            select: {
              id: true,
              naam: true,
              omschrijving: true,
              actief: true,
            },
          },
        },
      },
    },
    orderBy: {
      selectietijdstip: "asc",
    },
  },
} as const;

export function mapTaakSelectie(record: TaakSelectieRecord) {
  const selectiesByStekkerId = new Map(
    record.selecties.map((selectie) => [selectie.stekkerId, selectie])
  );

  return {
    taak: {
      id: record.id,
      naam: record.naam,
      status: record.status,
      peildatum: record.peildatum?.toISOString() ?? null,
      taakdefinitie: record.taakdefinitie,
    },
    stekkers: record.taakdefinitie.stekkers.map(({ stekker }) => {
      const selectie = selectiesByStekkerId.get(stekker.id);
      const configuratie = selectie?.stekkerConfiguratie ?? stekker.configuraties[0];

      return {
        stekker: {
          id: stekker.id,
          naam: stekker.naam,
          omschrijving: stekker.omschrijving,
          actief: stekker.actief,
        },
        configuratie: configuratie
          ? {
              id: configuratie.id,
              versie: configuratie.versie,
              baseUrl: configuratie.baseUrl,
              verwachteApiMajor: configuratie.verwachteApiMajor,
            }
          : null,
        selectie: selectie
          ? {
              id: selectie.id,
              externSelectieId: selectie.externSelectieId,
              status: selectie.status,
              peildatum: selectie.peildatum?.toISOString() ?? null,
              selectietijdstip: selectie.selectietijdstip?.toISOString() ?? null,
              totaalKandidaten: selectie.totaalKandidaten,
              totaalObjecten: selectie.totaalObjecten,
              totaalBetrokkenen: selectie.totaalBetrokkenen,
              stekkerversie: selectie.stekkerversie,
              configuratieversie: selectie.configuratieversie,
              apiVersie: selectie.apiVersie,
              geimporteerd: selectie.geimporteerd,
              fout: selectie.fout,
            }
          : null,
      };
    }),
  };
}
