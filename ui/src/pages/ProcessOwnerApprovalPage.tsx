import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSearch } from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import PageActionBar from "../components/PageActionBar";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import { listReviewRows } from "../shared/api/cockpitApi";
import type { VernietigingsObject } from "../shared/types/destruction";

type ExceptionDecision = "akkoord" | "aanpassen" | "terug";

const DECISION_LABELS: Record<ExceptionDecision, string> = {
  akkoord: "Uitzondering akkoord",
  aanpassen: "Aanpassen voor archivaris",
  terug: "Terug naar recordmanager",
};

export default function ProcessOwnerApprovalPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();
  const [reviewRows, setReviewRows] = useState<VernietigingsObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const exceptionRows = reviewRows.filter((row) => row.uitgesloten);
  const approvedRowsCount = reviewRows.length - exceptionRows.length;
  const [exceptionDecisions, setExceptionDecisions] = useState<
    Record<string, ExceptionDecision>
  >({});
  const [recordComments, setRecordComments] = useState<Record<string, string>>(() =>
    ({})
  );
  const [returnComment, setReturnComment] = useState("");
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
                .filter((row) => row.proceseigenaarToelichting)
                .map((row) => [row.id, row.proceseigenaarToelichting || ""])
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
    recordComments[row.id] ?? row.proceseigenaarToelichting ?? "";

  const updateExceptionDecision = (rowId: string, value: ExceptionDecision) => {
    setExceptionDecisions((currentDecisions) => ({
      ...currentDecisions,
      [rowId]: value,
    }));
  };

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
        subtitel="Beoordeel vooral de uitzonderingen die door de recordmanager zijn gemarkeerd voordat de lijst doorgaat naar de archivaris."
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

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500">
          Reviewregels laden...
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Uitzonderingen
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-950">
            {exceptionRows.length}
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Records vragen inhoudelijke beoordeling.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Zonder uitzondering
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {approvedRowsCount}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Deze records zijn niet uitgesloten.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <FileSearch className="h-4 w-4 text-blue-600" />
            Beoordeling
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {reviewRows.length}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Totaal in deze taakuitvoering.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Uitzonderingen inhoudelijk beoordelen
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Bekijk per uitzondering de reden, context en broninformatie. Leg daarna je oordeel vast.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {exceptionRows.map((row) => {
            const decision = exceptionDecisions[row.id] ?? "akkoord";
            const periode =
              row.startdatum && row.einddatum
                ? `${row.startdatum} - ${row.einddatum}`
                : "Onbekende periode";

            return (
              <article key={row.id} className="px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                        Uitzondering
                      </span>
                      <span className="text-xs text-gray-500">
                        {row.bron_id ?? "Geen bron-ID"}
                      </span>
                    </div>

                    <h3 className="mt-2 text-base font-semibold text-gray-900">
                      {row.titel}
                    </h3>

                    <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Reden
                        </dt>
                        <dd className="mt-1 text-gray-900">
                          {row.reden || "Geen reden opgegeven"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Periode
                        </dt>
                        <dd className="mt-1 text-gray-900">{periode}</dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Bronsysteem
                        </dt>
                        <dd className="mt-1 text-gray-900">
                          {row.bron_systeem || "Onbekend"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Vernietigingsdatum
                        </dt>
                        <dd className="mt-1 text-gray-900">
                          {row.vernietigingsdatum}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Bewaartermijn
                        </dt>
                        <dd className="mt-1 text-gray-900">
                          {row.bewaartermijn} jaar
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Selectielijst
                        </dt>
                        <dd className="mt-1 text-gray-900">
                          {row.selectielijst || "Niet ingevuld"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span className="font-medium">Toelichting recordmanager: </span>
                      {row.toelichting || "Geen aanvullende toelichting ingevuld."}
                    </div>
                  </div>

                  <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 lg:w-[320px]">
                    <label className="text-sm font-medium text-gray-900">
                      Beoordeling proceseigenaar
                      <select
                        value={decision}
                        onChange={(event) =>
                          updateExceptionDecision(
                            row.id,
                            event.target.value as ExceptionDecision
                          )
                        }
                        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      >
                        {Object.entries(DECISION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-3 block text-sm font-medium text-gray-900">
                      Toelichting
                      <textarea
                        value={getRecordComment(row)}
                        onChange={(event) =>
                          updateRecordComment(row.id, event.target.value)
                        }
                        rows={3}
                        placeholder="Leg je oordeel over deze uitzondering vast..."
                        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                    </label>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Algemene beoordeling proceseigenaar
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Vat je oordeel over de uitzonderingen samen voor de archivaris.
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
              placeholder="Bijvoorbeeld: uitzonderingen akkoord, aanvullende controle nodig, of terug naar recordmanager..."
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
