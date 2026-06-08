import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { VernietigingsObject } from "../../../shared/types/destruction";
import type { TaskExecutionComment } from "../../../shared/types/taskExecution";

type RecordDetailsItem = {
  label: string;
  value: string;
  badgeClassName?: string;
};

type RecordDetailsTab = "details" | "opmerkingen";

type Props = {
  record: Pick<VernietigingsObject, "titel">;
  comments: TaskExecutionComment[];
  currentIndex: number;
  totalCount: number;
  details: RecordDetailsItem[];
  onPrevious?: () => void;
  onNext?: () => void;
  heading?: string;
};

export default function RecordDetailsPanel({
  record,
  comments,
  currentIndex,
  totalCount,
  details,
  onPrevious,
  onNext,
  heading = "Record details",
}: Props) {
  const [activeTab, setActiveTab] = useState<RecordDetailsTab>("details");

  return (
    <section className="flex min-h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-slate-900">{heading}</p>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!onPrevious}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Vorig record"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-12 text-center text-xs font-semibold text-slate-500">
              {totalCount > 0 && currentIndex > 0 ? `${currentIndex} van ${totalCount}` : "0 van 0"}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Volgend record"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-lg font-semibold leading-7 tracking-tight text-slate-950">
          {record.titel}
        </h2>

        <div className="mt-4 border-b border-slate-200">
          <div className="flex gap-8">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`border-b-2 pb-3 text-sm font-semibold transition ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("opmerkingen")}
              className={`border-b-2 pb-3 text-sm font-semibold transition ${
                activeTab === "opmerkingen"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Opmerkingen
            </button>
          </div>
        </div>

        <div className="pt-4">
          {activeTab === "details" ? (
            <dl className="space-y-0">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0"
                >
                  <dt className="text-[13px] font-medium leading-5 text-slate-500">{item.label}</dt>
                  <dd className="text-[13px] font-semibold leading-5 text-slate-900">
                    {item.badgeClassName ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${item.badgeClassName}`}
                      >
                        {item.value}
                      </span>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <article
                  key={`${comment.author}-${comment.timestamp}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                      <p className="text-xs text-slate-500">{comment.role}</p>
                    </div>
                    <p className="text-xs text-slate-400">{comment.timestamp}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{comment.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-500">
              Er zijn nog geen opmerkingen toegevoegd.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
