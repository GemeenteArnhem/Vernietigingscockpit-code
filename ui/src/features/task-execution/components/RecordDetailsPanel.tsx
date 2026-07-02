import {
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";

import type { VernietigingsObject } from "../../../shared/types/destruction";
import type { TaskExecutionComment } from "../../../shared/types/taskExecution";

type RecordDetailsItem = {
  label: string;
  value: string;
  badgeClassName?: string;
  stacked?: boolean;
  labelTitle?: string;
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
  showTabs?: boolean;
  counterLabel?: string;
  detailsNotice?: string;
  emptyCommentsMessage?: string;
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
  showTabs = true,
  counterLabel,
  detailsNotice,
  emptyCommentsMessage = "Er zijn nog geen opmerkingen toegevoegd.",
}: Props) {
  const [activeTab, setActiveTab] = useState<RecordDetailsTab>("details");

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-[69px] items-center px-4">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-slate-900">{heading}</p>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!onPrevious}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Vorig record"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-10 text-center text-[11px] font-semibold text-slate-500">
              {counterLabel ??
                (totalCount > 0 && currentIndex > 0 ? `${currentIndex} van ${totalCount}` : "0 van 0")}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Volgend record"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-4 ${showTabs ? "py-0" : "py-4"}`}>
        {showTabs ? (
          <div className="-mx-4 border-b border-slate-200 px-4">
            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`flex items-center justify-center border-b-2 pb-3 text-sm font-semibold transition ${
                  activeTab === "details"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={14} />
                  <span>Details</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("opmerkingen")}
                className={`flex items-center justify-center border-b-2 pb-3 text-sm font-semibold transition ${
                  activeTab === "opmerkingen"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare size={14} />
                  <span>Opmerkingen</span>
                </span>
              </button>
            </div>
          </div>
        ) : null}

        <div className={showTabs ? "pt-4" : ""}>
          {(!showTabs || activeTab === "details") ? (
            <section aria-label={`Details van ${record.titel}`}>
              {detailsNotice ? (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-5 text-slate-600">
                  {detailsNotice}
                </div>
              ) : null}
              <dl className="space-y-0">
                {details.map((item) => (
                  <div
                    key={item.label}
                    className={
                      item.stacked
                        ? "border-b border-slate-100 px-0 py-2.5 last:border-b-0"
                        : "grid grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-4 border-b border-slate-100 px-0 py-2.5 last:border-b-0"
                    }
                  >
                    <dt
                      title={item.labelTitle}
                      className="text-[12.5px] font-medium leading-5 text-slate-500"
                    >
                      {item.label}
                    </dt>
                    <dd
                      className={
                        item.stacked
                          ? "mt-1 text-[14px] font-semibold leading-5 text-slate-900"
                          : "text-[12.5px] font-semibold leading-5 text-slate-900"
                      }
                    >
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
            </section>
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
              {emptyCommentsMessage}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
