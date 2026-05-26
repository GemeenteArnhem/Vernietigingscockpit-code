import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import PageActionBar from "../components/PageActionBar";
import ApprovalRecordTable from "../features/task-execution/approval/components/ApprovalRecordTable";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import { reviewRows } from "../shared/mocks/reviewRows";
import type { VernietigingsObject } from "../shared/types/destruction";

export default function ProcessOwnerApprovalPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const [recordComments, setRecordComments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      reviewRows
        .filter((row) => row.proceseigenaarToelichting)
        .map((row) => [row.id, row.proceseigenaarToelichting || ""])
    )
  );
  const [returnComment, setReturnComment] = useState("");
  const [commentSectionOpen, setCommentSectionOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateRecordComment = (rowId: string, value: string) => {
    setRecordComments((currentComments) => ({
      ...currentComments,
      [rowId]: value,
    }));
  };

  const getRecordComment = (row: VernietigingsObject) =>
    recordComments[row.id] ?? row.proceseigenaarToelichting ?? "";

  const goToArchivistApproval = () => {
    setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        items={[
          { label: "Taken", onClick: () => console.log("Taken") },
          { label: "Zorgdomein" },
          { label: "Taakuitvoering" },
          { label: "Accordering proceseigenaar" },
        ]}
      />

      <PageHeader
        titel="Zorgdomein 2025"
        subtitel="Bekijk de door de recordmanager opgestelde lijst en stel deze vast voor de volgende processtap."
        badge={{
          label: "Accordering proceseigenaar",
          color: "yellow",
        }}
        actions={[
          {
            label: "Doorzetten naar archivaris",
            variant: "primary",
            icon: <ArrowRight className="h-3.5 w-3.5" />,
            onClick: goToArchivistApproval,
          },
        ]}
      />

      <WorkflowBar activeStep="ACCORDERING_PO" />

      <ApprovalRecordTable
        rows={reviewRows}
        approvalCommentLabel="Toelichting proceseigenaar"
        approvalCommentValue={getRecordComment}
        onApprovalCommentChange={updateRecordComment}
      />

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Toelichting proceseigenaar
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Voeg een algemene opmerking toe voor de hele accordering.
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
              value={returnComment}
              onChange={(event) => setReturnComment(event.target.value)}
              rows={3}
              placeholder="Voeg hier je opmerking of bestuurlijke toelichting toe..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        )}
      </section>

      <PageActionBar
        nextLabel="Doorzetten naar archivaris"
        backLabel="Terug naar recordmanager"
        onNext={goToArchivistApproval}
        onBack={() => navigate(-1)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Doorzetten naar archivaris?"
        description="Je staat op het punt deze accordering af te ronden en de lijst door te zetten naar de archivaris voor de volgende stap."
        confirmLabel="Ja, doorzetten"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          navigate(`/taak/${taakId}/taakuitvoering/${id}/accordering/archivaris`);
        }}
      />
    </div>
  );
}
