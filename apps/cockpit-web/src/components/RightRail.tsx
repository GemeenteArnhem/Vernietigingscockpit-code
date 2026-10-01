type RightRailProps = {
  showDetailPane: boolean;
  showActionPane: boolean;
  onDetailPaneRef: (node: HTMLDivElement | null) => void;
  onActionPaneRef: (node: HTMLDivElement | null) => void;
};

export default function RightRail({
  showDetailPane,
  showActionPane,
  onDetailPaneRef,
  onActionPaneRef,
}: RightRailProps) {
  if (!showDetailPane && !showActionPane) {
    return null;
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white">
      {showDetailPane && (
        <div
          ref={onDetailPaneRef}
          className={`flex min-h-0 flex-col overflow-hidden ${
            showActionPane ? "flex-1 border-b border-slate-200" : "flex-1"
          }`}
        />
      )}

      {showActionPane && (
        <div
          ref={onActionPaneRef}
          className={`flex min-h-0 flex-col overflow-hidden ${
            showDetailPane ? "shrink-0" : "flex-1"
          }`}
        />
      )}
    </aside>
  );
}
