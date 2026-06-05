type Item = {
  label: string;
  value: string;
};

const items: Item[] = [
  { label: "Recordmanager", value: "Jan de Vries" },
  { label: "Periode", value: "01-01-2019 t/m 31-12-2020" },
  { label: "Selectiedatum", value: "15-05-2025" },
  { label: "Startdatum", value: "15-05-2025" },
];

export default function TaskMetaBar() {
  return (
    <div className="border border-gray-200 rounded-xl px-4 py-2.5 mb-2">
      <div className="flex items-center">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <div key={index} className="flex items-center flex-1">
              
              {/* content */}
              <div className="flex flex-col">
                <span className="text-xs text-gray-400">
                  {item.label}
                </span>

                <span className="text-sm font-medium text-gray-900 mt-1">
                  {item.value}
                </span>
              </div>

              {/* divider */}
              {!isLast && (
                <div className="w-px h-8 bg-gray-200 mx-6" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}