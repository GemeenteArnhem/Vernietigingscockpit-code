import { useMemo, useState } from "react";
import { Archive, Download, FileOutput } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import PageHeader from "../components/PageHeader";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import DestructionResultBar from "../features/task-execution/results/components/DestructionResultBar";
import DestructionResultFilters from "../features/task-execution/results/components/DestructionResultFilters";
import DestructionResultTable from "../features/task-execution/results/components/DestructionResultTable";
import { destructionResultRows } from "../shared/mocks/destructionResultRows";
import type {
  DestructionResultColumnKey,
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
  const [visibleColumns, setVisibleColumns] =
    useState<Record<DestructionResultColumnKey, boolean>>(COLUMN_DEFAULTS);
  const [statusFilter, setStatusFilter] =
    useState<DestructionResultStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleColumn = (key: DestructionResultColumnKey) => {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const resultRows = useMemo(() => destructionResultRows, []);

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

        <DestructionResultTable
          rows={resultRows}
          visibleColumns={visibleColumns}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}
