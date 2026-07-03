import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import PageActionBar from "../components/PageActionBar";
import ApprovalRecordTable from "../features/task-execution/approval/components/ApprovalRecordTable";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import { listReviewRows } from "../shared/api/cockpitApi";
import type { VernietigingsObject } from "../shared/types/destruction";

export default function ArchivistApprovalPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const [reviewRows, setReviewRows] = useState<VernietigingsObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordComments, setRecordComments] = useState<Record<string, string>>(() =>
    ({})
  );
  const [approvalComment, setApprovalComment] = useState("");
  const [commentSectionOpen, setCommentSectionOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
          setReviewRows(response.items);
          setRecordComments(
            Object.fromEntries(
              response.items
                .filter((row) => row.archivarisToelichting)
                .map((row) => [row.id, row.archivarisToelichting || ""])
            )
          );
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

  const updateRecordComment = (rowId: string, value: string) => {
    setRecordComments((currentComments) => ({
      ...currentComments,
      [rowId]: value,
    }));
  };

  const getRecordComment = (row: VernietigingsObject) =>
    recordComments[row.id] ?? row.archivarisToelichting ?? "";

  const goToExecution = () => {
    setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        items={[
          { label: "Taken", onClick: () => console.log("Taken") },
          { label: "Zorgdomein" },
          { label: "Taakuitvoering" },
          { label: "Accordering archivaris" },
        ]}
      />

      <PageHeader
        titel="Zorgdomein 2025"
        subtitel="Bekijk de vastgestelde lijst en beoordeel deze als archivaris voordat de uitvoering wordt vrijgegeven."
        badge={{
          label: "Accordering archivaris",
          color: "yellow",
        }}
        actions={[
          {
            label: "Doorzetten naar uitvoering",
            variant: "primary",
            icon: <ArrowRight className="h-3.5 w-3.5" />,
            onClick: goToExecution,
          },
        ]}
      />

      <WorkflowBar activeStep="ACCORDERING_ARCH" />

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500">
          Reviewregels laden...
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <ApprovalRecordTable
          rows={reviewRows}
          approvalCommentLabel="Toelichting archivaris"
          approvalCommentValue={getRecordComment}
          onApprovalCommentChange={updateRecordComment}
        />
      )}

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Toelichting archivaris
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Voeg een algemene archivistische notitie toe voor de hele accordering.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCommentSectionOpen((current) => !current)}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            {commentSectionOpen ? "Verbergen" : "Openen"}
          </button>
        </div>

        {commentSectionOpen && (
          <div className="border-t border-gray-200 px-5 py-4">
            <textarea
              value={approvalComment}
              onChange={(event) => setApprovalComment(event.target.value)}
              rows={3}
              placeholder="Voeg hier je archivistische beoordeling of opmerking toe..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        )}
      </section>

      <PageActionBar
        nextLabel="Doorzetten naar uitvoering"
        backLabel="Terug naar recordmanager"
        onNext={goToExecution}
        onBack={() => navigate(-1)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Doorzetten naar uitvoering?"
        description="Je bevestigt hiermee dat de archivistische accordering gereed is en dat de vernietiging kan worden klaargezet voor uitvoering."
        confirmLabel="Ja, naar uitvoering"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          navigate(`/taak/${taakId}/taakuitvoering/${id}/uitvoering`);
        }}
      />
    </div>
  );
}
