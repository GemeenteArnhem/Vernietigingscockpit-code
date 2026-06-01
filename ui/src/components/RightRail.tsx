type RightRailProps = {
  context?: React.ReactNode;
  actions?: React.ReactNode;
};

export default function RightRail({ context, actions }: RightRailProps) {
  return (
    <aside className="h-screen w-[380px] border-l border-gray-200 bg-white flex flex-col">
      
      {/* Context (top) */}
      {context && (
        <div className="flex-1 overflow-hidden border-b border-gray-200">
          {context}
        </div>
      )}

      {/* Actions (bottom) */}
      {actions && (
        <div className="shrink-0 overflow-auto p-3">
          {actions}
        </div>
      )}

    </aside>
  );
}