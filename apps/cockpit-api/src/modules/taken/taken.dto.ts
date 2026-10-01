type MedewerkerSummaryRecord = {
  id: string;
  naam: string;
  email: string;
};

type TaakdefinitieSummaryRecord = {
  id: string;
  naam: string;
  categorie: string;
  frequentie: string;
};

type SelectieSummaryRecord = {
  totaalKandidaten: number;
  totaalObjecten: number;
  totaalBetrokkenen: number;
};

type TaakinstantieRecord = {
  id: string;
  naam: string;
  status: string;
  stapSinds: Date;
  ronde: number;
  peildatum: Date | null;
  gestartOp: Date | null;
  afgerondOp: Date | null;
  versie: number;
  taakdefinitie: TaakdefinitieSummaryRecord;
  recordmanager: MedewerkerSummaryRecord;
  proceseigenaar: MedewerkerSummaryRecord;
  archivaris: MedewerkerSummaryRecord;
  selecties: SelectieSummaryRecord[];
};

export const taakinstantieSelect = {
  id: true,
  naam: true,
  status: true,
  stapSinds: true,
  ronde: true,
  peildatum: true,
  gestartOp: true,
  afgerondOp: true,
  versie: true,
  taakdefinitie: {
    select: {
      id: true,
      naam: true,
      categorie: true,
      frequentie: true,
    },
  },
  recordmanager: {
    select: {
      id: true,
      naam: true,
      email: true,
    },
  },
  proceseigenaar: {
    select: {
      id: true,
      naam: true,
      email: true,
    },
  },
  archivaris: {
    select: {
      id: true,
      naam: true,
      email: true,
    },
  },
  selecties: {
    select: {
      totaalKandidaten: true,
      totaalObjecten: true,
      totaalBetrokkenen: true,
    },
  },
} as const;

export function mapTaakinstantie(record: TaakinstantieRecord) {
  return mapTaakinstantieMetActies(record, []);
}

export function mapTaakinstantieMetActies(
  record: TaakinstantieRecord,
  toegestaneActies: string[]
) {
  return {
    id: record.id,
    naam: record.naam,
    status: record.status,
    stapSinds: record.stapSinds.toISOString(),
    ronde: record.ronde,
    peildatum: record.peildatum?.toISOString() ?? null,
    gestartOp: record.gestartOp?.toISOString() ?? null,
    afgerondOp: record.afgerondOp?.toISOString() ?? null,
    versie: record.versie,
    taakdefinitie: record.taakdefinitie,
    verantwoordelijken: {
      recordmanager: record.recordmanager,
      proceseigenaar: record.proceseigenaar,
      archivaris: record.archivaris,
    },
    tellingen: record.selecties.reduce(
      (total, selectie) => ({
        totaalKandidaten:
          total.totaalKandidaten + selectie.totaalKandidaten,
        totaalObjecten: total.totaalObjecten + selectie.totaalObjecten,
        totaalBetrokkenen:
          total.totaalBetrokkenen + selectie.totaalBetrokkenen,
      }),
      {
        totaalKandidaten: 0,
        totaalObjecten: 0,
        totaalBetrokkenen: 0,
      }
    ),
    toegestaneActies,
  };
}
