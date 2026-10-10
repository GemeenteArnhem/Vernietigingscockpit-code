import type { AppRole } from "../auth/app-role.js";
import type { ApiVerwijzing } from "@vernietigingscockpit/api-contract";

type AfdelingRecord = {
  id: string;
  naam: string;
  code: string;
  actief: boolean;
};

type MedewerkerRecord = {
  id: string;
  naam: string;
  email: string;
  rollen: AppRole[];
  actief: boolean;
  bron: string;
  externId: string | null;
  archiefvormer?: unknown;
  afdeling: AfdelingRecord | null;
};

export function mapAfdeling(record: AfdelingRecord) {
  return {
    id: record.id,
    naam: record.naam,
    code: record.code,
    actief: record.actief,
  };
}

export function mapMedewerker(record: MedewerkerRecord) {
  return {
    id: record.id,
    naam: record.naam,
    email: record.email,
    rollen: record.rollen,
    actief: record.actief,
    bron: record.bron,
    externId: record.externId,
    archiefvormer: (record.archiefvormer ?? null) as ApiVerwijzing | null,
    afdeling: record.afdeling ? mapAfdeling(record.afdeling) : null,
  };
}
