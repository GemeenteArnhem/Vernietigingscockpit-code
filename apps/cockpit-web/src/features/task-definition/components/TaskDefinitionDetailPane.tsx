import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  PlugZap,
} from "lucide-react";
import { useState } from "react";

import StatusBadge from "../../../components/StatusBadge";
import type {
  TaskDefinitionInstance,
  TaskDefinitionRecord,
} from "../../../shared/types/taskDefinition";

type TaskDefinitionDetailItem = {
  label: string;
  value: string;
};

type Props = {
  definition: TaskDefinitionRecord;
  currentIndex: number;
  totalCount: number;
  details: TaskDefinitionDetailItem[];
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenExecution?: (instance: TaskDefinitionInstance) => void;
};

type DetailTab =
  | "details"
  | "uitvoeringen"
  | "stekkers";

function ProgressBar({
  value,
  status,
}: {
  value: number;
  status: TaskDefinitionInstance["status"];
}) {
  const barClassName =
    status === "VERTRAAGD"
      ? "bg-red-500"
      : status === "VOLTOOID"
        ? "bg-emerald-500"
        : status === "GEPLAND"
          ? "bg-slate-300"
          : "bg-blue-500";

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span>{value === 0 ? "Nog niet gestart" : "Voortgang"}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function TaskDefinitionDetailPane({
  definition,
  currentIndex,
  totalCount,
  details,
  onPrevious,
  onNext,
  onOpenExecution,
}: Props) {
  const [activeTab, setActiveTab] =
    useState<DetailTab>("details");

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-[69px] items-center px-4">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="truncate text-[15px] font-semibold text-slate-900">
            Taakdefinitie details
          </p>

          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!onPrevious}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Vorige taakdefinitie"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-10 text-center text-[11px] font-semibold text-slate-500">
              {totalCount > 0 ? `${currentIndex} van ${totalCount}` : "0 van 0"}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!onNext}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Volgende taakdefinitie"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="-mx-0 border-b border-slate-200 px-4">
        <div className="grid grid-cols-3">
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
            onClick={() => setActiveTab("uitvoeringen")}
            className={`flex items-center justify-center border-b-2 pb-3 text-sm font-semibold transition ${
              activeTab === "uitvoeringen"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <FolderKanban size={14} />
              <span>Uitvoeringen</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stekkers")}
            className={`flex items-center justify-center border-b-2 pb-3 text-sm font-semibold transition ${
              activeTab === "stekkers"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <PlugZap size={14} />
              <span>Stekkers</span>
            </span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "details" ? (
          <div className="border-b border-slate-200 bg-white">
            <dl className="space-y-0">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <dt className="text-[12.5px] font-medium text-slate-500">
                    {item.label}
                  </dt>
                  <dd className="text-[12.5px] font-semibold text-slate-900">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : activeTab === "uitvoeringen" ? (
          <div className="space-y-3 px-4 py-4">
            {definition.instanties.map((instance) => (
              <button
                key={instance.id}
                type="button"
                onClick={() => onOpenExecution?.(instance)}
                className="block w-full rounded-md border border-slate-200 bg-white px-4 py-4 text-left shadow-sm shadow-slate-200/30 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {instance.naam}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {instance.subtitle}
                    </p>
                  </div>
                  <StatusBadge
                    status={instance.status}
                  />
                </div>

                <dl className="mt-3 grid gap-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Processtap</dt>
                    <dd className="font-medium text-slate-700">
                      {instance.stap}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Recordmanager</dt>
                    <dd className="font-medium text-slate-700">
                      {instance.recordmanager}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Startdatum</dt>
                    <dd className="font-medium text-slate-700">
                      {instance.startdatum}
                    </dd>
                  </div>
                </dl>

                <ProgressBar
                  value={instance.voortgang}
                  status={instance.status}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 px-4 py-4">
            {definition.stekkers.map((stekker) => (
              <div
                key={stekker.id ?? stekker.naam}
                className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {stekker.naam}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {stekker.type}
                    </p>
                  </div>
                  <StatusBadge
                    status={stekker.status}
                  />
                </div>

                <dl className="mt-3 grid gap-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Type</dt>
                    <dd className="font-medium text-slate-700">
                      {stekker.type}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt>Omschrijving</dt>
                    <dd className="max-w-[55%] text-right font-medium text-slate-700">
                      {stekker.omschrijving ??
                        "Geen omschrijving"}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
