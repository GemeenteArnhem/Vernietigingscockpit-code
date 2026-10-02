import {
  mapTaakinstantie,
  mapTaakinstantieMetActies,
} from "../taken/taken.dto.js";

type MedewerkerSummaryRecord = {
  id: string;
  naam: string;
  email: string;
};

type StekkerRecord = {
  stekker: {
    id: string;
    naam: string;
    omschrijving: string | null;
    actief: boolean;
  };
};

type SelectieSummaryRecord = {
  status: string;
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
  taakdefinitie: {
    id: string;
    naam: string;
    categorie: string;
    frequentie: string;
  };
  recordmanager: MedewerkerSummaryRecord;
  proceseigenaar: MedewerkerSummaryRecord;
  archivaris: MedewerkerSummaryRecord;
  selecties: SelectieSummaryRecord[];
};

type TaakdefinitieRecord = {
  id: string;
  naam: string;
  omschrijving: string | null;
  categorie: string;
  frequentie: string;
  actief: boolean;
  versie: number;
  recordmanager: MedewerkerSummaryRecord;
  proceseigenaar: MedewerkerSummaryRecord;
  archivaris: MedewerkerSummaryRecord;
  stekkers: StekkerRecord[];
  instanties: TaakinstantieRecord[];
};

const medewerkerSummarySelect = {
  id: true,
  naam: true,
  email: true,
} as const;

export const taakdefinitieSelect = {
  id: true,
  naam: true,
  omschrijving: true,
  categorie: true,
  frequentie: true,
  actief: true,
  versie: true,
  recordmanager: {
    select: medewerkerSummarySelect,
  },
  proceseigenaar: {
    select: medewerkerSummarySelect,
  },
  archivaris: {
    select: medewerkerSummarySelect,
  },
  stekkers: {
    select: {
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
  instanties: {
    select: {
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
        select: medewerkerSummarySelect,
      },
      proceseigenaar: {
        select: medewerkerSummarySelect,
      },
      archivaris: {
        select: medewerkerSummarySelect,
      },
      selecties: {
        select: {
          status: true,
          totaalKandidaten: true,
          totaalObjecten: true,
          totaalBetrokkenen: true,
        },
      },
    },
    orderBy: {
      stapSinds: "desc",
    },
  },
} as const;

export function mapTaakdefinitie(record: TaakdefinitieRecord) {
  return mapTaakdefinitieMetActies(record, [], null);
}

export function mapTaakdefinitieMetActies(
  record: TaakdefinitieRecord,
  toegestaneActies: string[],
  instantieActies:
    | ((instantie: TaakinstantieRecord) => string[])
    | null
) {
  return {
    id: record.id,
    naam: record.naam,
    omschrijving: record.omschrijving,
    categorie: record.categorie,
    frequentie: record.frequentie,
    actief: record.actief,
    versie: record.versie,
    verantwoordelijken: {
      recordmanager: record.recordmanager,
      proceseigenaar: record.proceseigenaar,
      archivaris: record.archivaris,
    },
    stekkers: record.stekkers.map(({ stekker }) => ({
      id: stekker.id,
      naam: stekker.naam,
      omschrijving: stekker.omschrijving,
      actief: stekker.actief,
    })),
    instanties: record.instanties.map((instantie) =>
      instantieActies
        ? mapTaakinstantieMetActies(instantie, instantieActies(instantie))
        : mapTaakinstantie(instantie)
    ),
    toegestaneActies,
  };
}
