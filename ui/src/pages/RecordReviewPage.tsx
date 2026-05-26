import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import ConfirmDialog from "../components/ConfirmDialog";
import PageActionBar from "../components/PageActionBar";
import PageHeader from "../components/PageHeader";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import ReviewResultTable from "../features/task-execution/review/components/ReviewResultTable";
import ReviewSelectionBar from "../features/task-execution/review/components/ReviewSelectionBar";
import ReviewTableFilters from "../features/task-execution/review/components/ReviewTableFilters";
import ReviewValidationBanner from "../features/task-execution/review/components/ReviewValidationBanner";

import { reviewRows } from "../shared/mocks/reviewRows";
import type { ColumnKey } from "../shared/types/reviewColumns";
import type { VernietigingsObject } from "../shared/types/destruction";

const COLUMN_DEFAULTS: Record<ColumnKey, boolean> = {
  omvang: true,
  bewaartermijn: true,
  vernietigingsdatum: true,
  status: true,
  uitsluiten: true,
  toelichting: true,
  bron_id: false,
  code: false,
  periode: false,
  selectielijst: false,
  grondslag: false,
  bron_systeem: false,
};

function hasError(row: VernietigingsObject) {
  return Boolean(row.beoordeeld && row.uitgesloten && !row.toelichting?.trim());
}

export default function RecordReviewPage() {
  const navigate =
    useNavigate();
  const {
    taakId,
    id,
  } = useParams();

  const [rows, setRows] = useState(reviewRows);
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] =
    useState<Record<ColumnKey, boolean>>(COLUMN_DEFAULTS);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const hasSelectionErrors = selectedRows.some(hasError);
  const rowsWithErrors = rows.filter(hasError).length;
  const markSelectedAsReviewed = () => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        selected.includes(row.id)
          ? {
              ...row,
              beoordeeld: true,
            }
          : row
      )
    );
  };

  const goToProcessOwnerApproval = () => {
    setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        items={[
          { label: "Taken", onClick: () => console.log("Taken") },
          { label: "Zorgdomein" },
          { label: "Vernietigingslijst" },
          { label: "Beoordeling" },
        ]}
      />

      <PageHeader
        titel="Zorgdomein"
        subtitel="Beoordeel records en werk blokkades in de tabel weg."
        badge={{
          label: "Beoordeling",
          color: "blue",
        }}
        actions={[
          {
            label: "Door naar accordering",
            variant: "primary",
            icon: <ArrowRight className="h-3.5 w-3.5" />,
            onClick:
              goToProcessOwnerApproval,
          },
        ]}
      />

      <WorkflowBar activeStep="BEOORDELING" />

      <ReviewValidationBanner count={rowsWithErrors} />

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <ReviewTableFilters
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
        />

        <ReviewResultTable
          rows={rows}
          setRows={setRows}
          selected={selected}
          setSelected={setSelected}
          visibleColumns={visibleColumns}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
        />

        <ReviewSelectionBar
          count={selected.length}
          hasErrors={hasSelectionErrors}
          onClear={() => setSelected([])}
          onMarkReviewed={markSelectedAsReviewed}
        />
      </div>

      <PageActionBar
        onNext={
          goToProcessOwnerApproval
        }
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Door naar accordering?"
        description="Je verlaat de beoordelingsstap en zet de geselecteerde lijst door naar de proceseigenaar voor accordering."
        confirmLabel="Ja, door naar accordering"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          navigate(
            `/taak/${taakId}/taakuitvoering/${id}/accordering/proceseigenaar`
          );
        }}
      />
    </div>
  );
}
