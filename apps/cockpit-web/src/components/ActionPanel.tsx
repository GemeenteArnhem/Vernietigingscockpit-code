import type { ChangeEvent, ReactNode } from "react";
import { Paperclip, UploadCloud } from "lucide-react";

type ActionPanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  embedded?: boolean;
  titleClassName?: string;
  hideHeaderBorder?: boolean;
  hideFooterBorder?: boolean;
  bodyClassName?: string;
  bodyPaddingYClass?: string;
};

type ActionPanelSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

type ActionPanelChoiceProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  density?: "default" | "compact";
  selected?: boolean;
  onClick?: () => void;
};

type ActionPanelTextareaProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
};

type ActionPanelDropzoneProps = {
  label: string;
  description?: string;
};

type ActionPanelButtonProps = {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  hotkey?: string;
  disabled?: boolean;
};

export type ActionPanelShortcutProps = {
  keyLabel: string;
  label: string;
};

const choiceToneStyles = {
  primary: {
    selected:
      "border-sky-200 bg-sky-50 shadow-[0_0_0_1px_rgba(14,165,233,0.12)]",
    iconWrap: "bg-sky-50 text-sky-800",
    radio: "border-sky-600 bg-sky-600 shadow-[inset_0_0_0_3px_white]",
    rowSelected: "border-sky-200 bg-sky-50/80",
    rowIcon: "text-sky-700",
  },
  success: {
    selected:
      "border-emerald-200 bg-emerald-50 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]",
    iconWrap: "bg-emerald-50 text-emerald-800",
    radio: "border-emerald-600 bg-emerald-600 shadow-[inset_0_0_0_3px_white]",
    rowSelected: "border-emerald-200 bg-emerald-50/80",
    rowIcon: "text-emerald-700",
  },
  warning: {
    selected:
      "border-amber-200 bg-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.12)]",
    iconWrap: "bg-amber-50 text-amber-800",
    radio: "border-amber-600 bg-amber-600 shadow-[inset_0_0_0_3px_white]",
    rowSelected: "border-amber-200 bg-amber-50/80",
    rowIcon: "text-amber-700",
  },
  danger: {
    selected:
      "border-rose-200 bg-rose-50 shadow-[0_0_0_1px_rgba(244,63,94,0.12)]",
    iconWrap: "bg-rose-50 text-rose-800",
    radio: "border-rose-600 bg-rose-600 shadow-[inset_0_0_0_3px_white]",
    rowSelected: "border-rose-200 bg-rose-50/80",
    rowIcon: "text-rose-700",
  },
  neutral: {
    selected:
      "border-slate-300 bg-slate-50 shadow-[0_0_0_1px_rgba(148,163,184,0.16)]",
    iconWrap: "bg-slate-100 text-slate-600",
    radio: "border-slate-500 bg-slate-500 shadow-[inset_0_0_0_3px_white]",
    rowSelected: "border-slate-300 bg-slate-50/80",
    rowIcon: "text-slate-500",
  },
};

export default function ActionPanel({
  title,
  subtitle,
  children,
  footer,
  className = "",
  embedded = false,
  titleClassName = "",
  hideHeaderBorder = false,
  hideFooterBorder = false,
  bodyClassName = "",
  bodyPaddingYClass = "py-4",
}: ActionPanelProps) {
  return (
    <aside
      className={`flex min-h-0 flex-col bg-white ${
        embedded
          ? "w-full shrink-0"
          : "w-[340px] shrink-0 border-l border-slate-200"
      } ${className}`.trim()}
    >
      <div className={`${hideHeaderBorder ? "" : "border-b border-slate-200"} px-5 py-4`}>
        <h2 className={`text-base font-semibold text-slate-950 ${titleClassName}`.trim()}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto px-5 ${bodyPaddingYClass} ${bodyClassName}`.trim()}
      >
        <div className="space-y-5">{children}</div>
      </div>

      {footer && (
        <div className={`${hideFooterBorder ? "" : "border-t border-slate-200"} bg-white px-5 py-4`}>
          {footer}
        </div>
      )}
    </aside>
  );
}

export function ActionPanelSection({
  title,
  description,
  children,
}: ActionPanelSectionProps) {
  const hasHeading = Boolean(title || description);

  return (
    <section>
      {hasHeading ? (
        <div className="flex flex-col gap-1">
          {title ? <h3 className="text-sm font-semibold text-slate-900">{title}</h3> : null}
          {description && (
            <p className="text-sm leading-5 text-slate-500">{description}</p>
          )}
        </div>
      ) : null}

      <div className={hasHeading ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

export function ActionPanelChoice({
  title,
  description,
  icon,
  tone = "primary",
  density = "default",
  selected = false,
  onClick,
}: ActionPanelChoiceProps) {
  const toneStyle = choiceToneStyles[tone];
  const isCompact = density === "compact";

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isCompact
          ? `flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
              selected
                ? toneStyle.rowSelected
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`
          : `flex w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-all ${
              selected
                ? toneStyle.selected
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`
      }
    >
      <div
        className={`${isCompact ? "mt-0.5" : "mt-1"} h-4 w-4 shrink-0 rounded-full border ${
          selected
            ? toneStyle.radio
            : "border-slate-300 bg-white"
        }`}
      />

      {icon && (
        <div
          className={
            isCompact
              ? `mt-0.5 shrink-0 ${toneStyle.rowIcon}`
              : `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyle.iconWrap}`
          }
        >
          {icon}
        </div>
      )}

      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {description && (
          <div className={`${isCompact ? "mt-0.5 text-xs leading-[18px]" : "mt-1 text-sm leading-5"} text-slate-500`}>
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

export function ActionPanelTextarea({
  label,
  placeholder,
  value,
  onChange,
  maxLength = 500,
}: ActionPanelTextareaProps) {
  const handleChange = (
    event: ChangeEvent<HTMLTextAreaElement>
  ) => {
    onChange(event.target.value);
  };

  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="text-xs text-slate-400">
          {value.length}/{maxLength}
        </div>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-sm leading-5 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

export function ActionPanelDropzone({
  label,
  description = "Sleep bestanden hierheen of blader",
}: ActionPanelDropzoneProps) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <button
        type="button"
        className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3.5 py-3.5 text-left transition hover:border-slate-400 hover:bg-white"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm shadow-slate-200/50">
          <UploadCloud size={18} />
        </div>
        <div className="text-sm leading-5 text-slate-500">
          {description}
        </div>
      </button>
    </div>
  );
}

export function ActionPanelSummary({
  eyebrow,
  title,
  items,
}: {
  eyebrow?: string;
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {eyebrow}
        </p>
      )}
      <div className="mt-1 text-sm font-semibold text-slate-900">{title}</div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm text-slate-700">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ActionPanelButton({
  label,
  onClick,
  variant = "secondary",
  hotkey,
  disabled = false,
}: ActionPanelButtonProps) {
  const styles =
    variant === "primary"
      ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700"
      : variant === "ghost"
        ? "border-transparent bg-transparent text-slate-600 hover:bg-slate-100"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition ${styles} ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : ""
      }`}
    >
      <span>{label}</span>
      {hotkey && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-white/15 px-1.5 text-xs font-semibold">
          {hotkey}
        </span>
      )}
    </button>
  );
}

export function ActionPanelButtonGroup({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="space-y-2">{children}</div>;
}

export function ActionPanelShortcuts({
  shortcuts,
}: {
  shortcuts: ActionPanelShortcutProps[];
}) {
  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
      {shortcuts.map((shortcut) => (
        <div
          key={`${shortcut.keyLabel}-${shortcut.label}`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1"
        >
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1 font-semibold text-slate-600 shadow-sm shadow-slate-200/40">
            {shortcut.keyLabel}
          </span>
          <span>{shortcut.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ActionPanelEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center px-2">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm shadow-slate-200/40">
          <Paperclip size={20} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
