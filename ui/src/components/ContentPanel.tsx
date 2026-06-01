import type { ReactNode } from "react";

type ContentPanelProps = {
  children: ReactNode;
  className?: string;
};

type ContentPanelHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
};

type ContentPanelSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

type ContentPanelStatProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
};

type ContentPanelEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export default function ContentPanel({
  children,
  className = "",
}: ContentPanelProps) {
  return (
    <main
      className={`flex min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-slate-50/30 ${className}`.trim()}
    >
      {children}
    </main>
  );
}

export function ContentPanelBody({
  children,
  className = "",
}: ContentPanelProps) {
  return (
    <div className={`flex-1 overflow-y-auto p-4 ${className}`.trim()}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4">
        {children}
      </div>
    </div>
  );
}

export function ContentPanelHeader({
  eyebrow,
  title,
  subtitle,
  aside,
}: ContentPanelHeaderProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </div>
  );
}

export function ContentPanelSection({
  title,
  description,
  action,
  children,
}: ContentPanelSectionProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ContentPanelStatGrid({
  children,
}: ContentPanelProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}

export function ContentPanelStat({
  label,
  value,
  icon,
  hint,
}: ContentPanelStatProps) {
  return (
    <div className="rounded-sm border border-slate-200 bg-slate-50/80 px-3 py-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-white text-slate-500 shadow-sm shadow-slate-200/40">
            {icon}
          </div>
        )}

        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {value}
          </div>
          {hint && (
            <div className="mt-1 text-xs text-slate-500">
              {hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContentPanelEmptyState({
  title,
  description,
  icon,
}: ContentPanelEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-md border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center shadow-sm shadow-slate-200/40">
        {icon && (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 text-slate-500">
            {icon}
          </div>
        )}
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
