import { useCallback, useState } from "react";

import { verwijderOpmerking } from "../../../api/f3Data";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { TaskExecutionComment } from "../../../shared/types/taskExecution";

// Eigen opmerking verwijderen (besluit 2026-11-12): eerst bevestigen, dan logisch verwijderen
// en de lijst opnieuw laden. Geeft de handler voor RecordDetailsPanel en de bevestigingsdialoog.
export function useOpmerkingVerwijderen({
  accessToken,
  taakId,
  onVerwijderd,
  onFout,
}: {
  accessToken: string | undefined;
  taakId: string | undefined;
  onVerwijderd: () => void;
  onFout: (melding: string) => void;
}) {
  const [teVerwijderen, setTeVerwijderen] = useState<TaskExecutionComment | null>(null);
  const sluiten = useCallback(() => setTeVerwijderen(null), []);

  const bevestigen = async () => {
    const opmerking = teVerwijderen;
    setTeVerwijderen(null);

    if (!opmerking?.id || !opmerking.recordId || !accessToken || !taakId) {
      return;
    }

    try {
      await verwijderOpmerking(accessToken, taakId, opmerking.recordId, opmerking.id);
      onVerwijderd();
    } catch (error) {
      onFout(error instanceof Error ? error.message : "Opmerking verwijderen is mislukt.");
    }
  };

  return {
    onDeleteComment: setTeVerwijderen,
    dialoog: (
      <ConfirmDialog
        open={teVerwijderen !== null}
        title="Opmerking verwijderen?"
        description="De opmerking verdwijnt voor iedereen. In het auditlog blijft vastgelegd dat je hem hebt verwijderd."
        confirmLabel="Ja, verwijderen"
        onCancel={sluiten}
        onConfirm={() => {
          void bevestigen();
        }}
      />
    ),
  };
}
