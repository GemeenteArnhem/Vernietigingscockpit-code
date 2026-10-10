import { ContentPanelSection } from "../../../components/ContentPanel";
import type { VernietigingsKandidaat } from "../../../shared/types/destruction";
import { AANTAL_OBJECTEN_UITLEG } from "../review/bulkDetails";

type Props = {
  record: VernietigingsKandidaat;
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
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Identificatie</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.identificatie ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Stekker</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.stekker ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Classificatie</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.classificatie ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Informatiecategorie</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.informatiecategorie ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Begindatum dekking in tijd</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.dekkingInTijdBegindatum ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Einddatum dekking in tijd</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.dekkingInTijdEinddatum ?? "-"}</dd>
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
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.termijnLooptijd}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Einddatum bewaartermijn</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{vernietigbaarSinds}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Uitsluitreden</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{record.reden ?? "-"}</dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400" title={AANTAL_OBJECTEN_UITLEG}>Aantal objecten</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.aantalObjecten} object{record.aantalObjecten === 1 ? "" : "en"}
              </dd>
            </div>
            <div className="border-b border-slate-100 pb-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Aantal betrokkenen</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                {record.aantalBetrokkenen} betrokkene{record.aantalBetrokkenen === 1 ? "" : "n"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </ContentPanelSection>
  );
}
