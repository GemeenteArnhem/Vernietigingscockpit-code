import { useEffect, useState } from "react";
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

import { listReviewRows, markReviewRowsReviewed } from "../shared/api/cockpitApi";
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
  resultaat: false,
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

  const [rows, setRows] = useState<VernietigingsObject[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] =
    useState<Record<ColumnKey, boolean>>(COLUMN_DEFAULTS);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!taakId || !id) {
      return;
    }

    let ignore = false;

    setLoading(true);
    setLoadError(null);

    listReviewRows(taakId, id)
      .then((response) => {
        if (!ignore) {
          setRows(response.items);
        }
      })
      .catch(() => {
        if (!ignore) {
          setLoadError("Reviewregels konden niet worden geladen.");
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

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const hasSelectionErrors = selectedRows.some(hasError);
  const rowsWithErrors = rows.filter(hasError).length;
  const markSelectedAsReviewed = async () => {
    if (!taakId || !id || selected.length === 0) {
      return;
    }

    setActionError(null);

    try {
      await markReviewRowsReviewed(taakId, id, selected);

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
    } catch {
      setActionError("Geselecteerde reviewregels konden niet worden gemarkeerd.");
    }
  };

  const goToProcessOwnerApproval = () => {
    setActionError(null);
    setConfirmOpen(true);
  };

  const confirmProcessOwnerApproval = async () => {
    if (!taakId || !id || submitting) {
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const reviewregelIds = rows
        .filter((row) => !row.beoordeeld)
        .map((row) => row.id);

      if (reviewregelIds.length > 0) {
        await markReviewRowsReviewed(taakId, id, reviewregelIds);
      }

      setConfirmOpen(false);
      navigate(
        `/taak/${taakId}/taakuitvoering/${id}/accordering/proceseigenaar`
      );
    } catch {
      setActionError("Doorzetten naar accordering kon niet worden vastgelegd.");
    } finally {
      setSubmitting(false);
    }
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
            disabled: loading || submitting,
          },
        ]}
      />

      <WorkflowBar activeStep="BEOORDELING" />

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

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

        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-500">
            Reviewregels laden...
          </div>
        ) : loadError ? (
          <div className="px-5 py-8 text-sm text-red-700">
            {loadError}
          </div>
        ) : (
          <ReviewResultTable
            rows={rows}
            setRows={setRows}
            selected={selected}
            setSelected={setSelected}
            visibleColumns={visibleColumns}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
          />
        )}

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
        nextDisabled={loading || submitting}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Door naar accordering?"
        description="Je verlaat de beoordelingsstap en zet de geselecteerde lijst door naar de proceseigenaar voor accordering."
        confirmLabel={submitting ? "Bezig..." : "Ja, door naar accordering"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmProcessOwnerApproval}
      />
    </div>
  );
}
