import { ContentPanelSection } from "../../../components/ContentPanel";
import type { VernietigingsObject } from "../../../shared/types/destruction";

type Props = {
  record: VernietigingsObject;
  vernietigbaarSinds: string;
  title?: string;
  description?: string;
};

export default function RecordDetailsSection({
  record,
  vernietigbaarSinds,
  title = "Recorddetails",
  description = "Kerngegevens van het geselecteerde record, gegroepeerd op herkomst en vernietiging.",
}: Props) {
  return (
    <ContentPanelSection
      title={title}
      description={description}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-sm border border-slate-200 bg-slate-50/50 px-4 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Herkomst</h3>
          <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Bron-ID</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.bron_id ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Bronsysteem</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.bron_systeem ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Code</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.code ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Grondslag</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.grondslag ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Startdatum record</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.startdatum ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Einddatum record</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.einddatum ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-sm border border-slate-200 bg-slate-50/50 px-4 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Bewaren en vernietigen</h3>
          <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Selectielijst</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.selectielijst ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Bewaartermijn</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.bewaartermijn} jaar</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Vernietigbaar sinds</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{vernietigbaarSinds}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Uitsluitreden</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.reden ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Omvang documenten</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.omvangDocumenten} document{record.omvangDocumenten === 1 ? "" : "en"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Omvang clienten</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.omvangClienten} client{record.omvangClienten === 1 ? "" : "en"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </ContentPanelSection>
  );
}
