import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Archive, Download, FileOutput } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import PageHeader from "../components/PageHeader";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import DestructionResultBar from "../features/task-execution/results/components/DestructionResultBar";
import DestructionResultFilters from "../features/task-execution/results/components/DestructionResultFilters";
import DestructionResultTable from "../features/task-execution/results/components/DestructionResultTable";
import { listDestructionResults } from "../shared/api/cockpitApi";
import type {
  DestructionResultColumnKey,
  DestructionResultRow,
  DestructionResultStatus,
} from "../shared/types/destructionResult";

const COLUMN_DEFAULTS: Record<DestructionResultColumnKey, boolean> = {
  omvang: false,
  vernietigingsdatum: false,
  bron_id: false,
  code: false,
  grondslag: false,
  bron_systeem: false,
  melding: false,
};

export default function DestructionResultPage() {
  const { taakId, id } = useParams();
  const [visibleColumns, setVisibleColumns] =
    useState<Record<DestructionResultColumnKey, boolean>>(COLUMN_DEFAULTS);
  const [statusFilter, setStatusFilter] =
    useState<DestructionResultStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [resultRows, setResultRows] = useState<DestructionResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!taakId || !id) {
      return;
    }

    let ignore = false;

    setLoading(true);
    setLoadError(null);

    listDestructionResults(taakId, id)
      .then((response) => {
        if (!ignore) {
          setResultRows(response.items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setLoadError("Resultaatregels konden niet worden geladen.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [taakId, id]);

  const toggleColumn = (key: DestructionResultColumnKey) => {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        items={[
          { label: "Taken" },
          { label: "Zorgdomein" },
          { label: "Vernietigingslijst" },
          { label: "Resultaat" },
        ]}
      />

      <PageHeader
        titel="Zorgdomein"
        subtitel="Bekijk de uitkomsten per record, download de verklaring en archiveer de afgeronde stap."
        badge={{
          label: "Resultaat",
          color: "green",
        }}
        actions={[
          {
            label: "Verklaring downloaden",
            variant: "secondary",
            icon: <Download className="h-3.5 w-3.5" />,
          },
          {
            label: "Exporteren",
            variant: "secondary",
            icon: <FileOutput className="h-3.5 w-3.5" />,
          },
          {
            label: "Archiveren",
            variant: "secondary",
            icon: <Archive className="h-3.5 w-3.5" />,
          },
        ]}
      />

      <WorkflowBar activeStep="RESULTAAT" />

      <DestructionResultBar rows={resultRows} />

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <DestructionResultFilters
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
        />

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500">
            Resultaatregels laden...
          </div>
        ) : loadError ? (
          <div className="px-5 py-8 text-sm text-red-700">
            {loadError}
          </div>
        ) : (
          <DestructionResultTable
            rows={resultRows}
            visibleColumns={visibleColumns}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
}
