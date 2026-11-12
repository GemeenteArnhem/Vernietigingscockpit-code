import { useEffect, useState } from "react";

import { getTaakinstantie } from "../../api/f3Data";
import { useSessionUser } from "../../auth/useSessionUser";

// Meekijken (besluit 2026-11-12): elke betrokkene (en de auditor) kan elk stapscherm openen.
// Alleen wie aan zet is, krijgt het actiepaneel; de anderen zien waar de taak nu ligt.

type Rol = "recordmanager" | "proceseigenaar" | "archivaris";

// Wie aan zet is in elke taakstatus; na archiveren niemand.
const ROL_VAN_STATUS: Record<string, Rol | undefined> = {
  init: "recordmanager",
  beoordeling: "recordmanager",
  accordering_po: "proceseigenaar",
  accordering_archivaris: "archivaris",
  vrijgegeven: "recordmanager",
  uitvoering: "recordmanager",
  resultaat: "recordmanager",
};

const STAP_LABELS: Record<string, string> = {
  init: "Selectie",
  beoordeling: "Beoordeling",
  accordering_po: "Accordering proceseigenaar",
  accordering_archivaris: "Accordering archivaris",
  vrijgegeven: "Vrijgegeven",
  uitvoering: "Uitvoering",
  resultaat: "Resultaat",
};

export type Meekijken = {
  // null zolang de taak nog niet geladen is.
  aanZet: boolean | null;
  melding: string;
};

export function useMeekijken({
  taakId,
  stapStatussen,
}: {
  taakId: string | undefined;
  // De taakstatussen waarin op dit scherm gehandeld wordt.
  stapStatussen: string[];
}): Meekijken {
  const { user, accessToken } = useSessionUser();
  const [stand, setStand] = useState<Meekijken>({ aanZet: null, melding: "" });
  // Als tekst, zodat nieuwe arrays bij elke render geen nieuw verzoek geven.
  const statussen = stapStatussen.join(",");
  const rollen = user.roles.join(",");

  useEffect(() => {
    if (!accessToken || !taakId) {
      return;
    }

    let actief = true;

    void getTaakinstantie(accessToken, taakId)
      .then((taak) => {
        if (!actief) {
          return;
        }

        const rol = ROL_VAN_STATUS[taak.status];
        const rolhouder = rol ? taak.verantwoordelijken[rol] : null;
        const isRolhouder =
          rol !== undefined && rollen.split(",").includes(rol) && rolhouder?.id === user.medewerkerId;
        const aanZet = isRolhouder && statussen.split(",").includes(taak.status);
        const waar = !rol
          ? "Deze taakuitvoering is gearchiveerd."
          : isRolhouder
            ? `Deze taakuitvoering staat in de stap ${STAP_LABELS[taak.status] ?? taak.status}.`
            : `Deze taakuitvoering ligt bij de ${rol} (${rolhouder?.naam ?? "onbekend"}), in de stap ${STAP_LABELS[taak.status] ?? taak.status}.`;

        setStand({ aanZet, melding: `${waar} Je kijkt mee; acties zijn hier niet beschikbaar.` });
      })
      .catch(() => {
        // Zonder taakgegevens geen acties; de pagina toont haar eigen foutmelding.
        if (actief) {
          setStand({ aanZet: false, melding: "De taakuitvoering kon niet worden geladen. Acties zijn niet beschikbaar." });
        }
      });

    return () => {
      actief = false;
    };
  }, [accessToken, rollen, statussen, taakId, user.medewerkerId]);

  return stand;
}
