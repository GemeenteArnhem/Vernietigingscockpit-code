import type { ActionPanelShortcutProps } from "./ActionPanel";

type ShortcutPaneProps = {
  shortcuts: ActionPanelShortcutProps[];
};

export default function ShortcutPane({
  shortcuts,
}: ShortcutPaneProps) {
  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <aside className="shrink-0 border-t border-slate-200 bg-white px-5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Sneltoetsen
        </span>

        {shortcuts.map((shortcut) => (
          <div
            key={`${shortcut.keyLabel}-${shortcut.label}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
          >
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1 font-semibold text-slate-700 shadow-sm shadow-slate-200/40">
              {shortcut.keyLabel}
            </span>
            <span>{shortcut.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
