type AuditItem = {
  id: string;
  date: string;
  title: string;
  user: string;
};

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      d="M5 12H19M19 12L13 6M19 12L13 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const data: AuditItem[] = [
  {
    id: "1",
    date: "15-05-2025 10:48",
    title: "Toelichting toegevoegd",
    user: "Jan de Vries (recordmanager)",
  },
  {
    id: "2",
    date: "15-05-2025 10:47",
    title: "Reden geselecteerd",
    user: "Jan de Vries (recordmanager)",
  },
  {
    id: "3",
    date: "15-05-2025 10:46",
    title: "2 objecten uitgesloten",
    user: "Jan de Vries (recordmanager)",
  },
  {
    id: "4",
    date: "15-05-2025 10:45",
    title: "Vernietigingslijst opgehaald",
    user: "Jan de Vries (recordmanager)",
  },
];

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      d="M4 5H20L14 12V19L10 21V12L4 5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      d="M6 9L12 15L18 9"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

export default function AuditLog() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl h-full flex flex-col">
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-900">
          Audit log
        </span>

        <button className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <FilterIcon />
          Filter
        </button>
      </div>

      {/* BODY */}
      <div className="relative px-4 py-3 flex-1 overflow-auto">

        {/* TIMELINE CONTAINER */}
        <div className="relative">

          {/* VERTICAL LINE (aligned with dot column center) */}
          <div className="absolute left-[12px] top-3 bottom-0 w-px bg-blue-200 z-0" />

          <div className="flex flex-col gap-6">

            {data.map((item) => (
              <div key={item.id} className="grid grid-cols-[24px_1fr] gap-2">

                {/* DOT COLUMN */}
                <div className="flex justify-center items-start pt-[6px]">
                    <div className="w-2 h-2 rounded-full bg-blue-600 relative z-10" />
                </div>

                {/* CONTENT */}
                <div className="flex flex-col">

                  {/* DATE */}
                  <span className="text-xs text-gray-400">
                    {item.date}
                  </span>

                  {/* TITLE + CHEVRON */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-medium text-gray-800">
                      {item.title}
                    </span>

                    <span className="text-gray-400">
                      <Chevron />
                    </span>
                  </div>

                  {/* USER */}
                  <span className="text-xs text-gray-500 mt-1">
                    {item.user}
                  </span>

                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
      {/* FOOTER */}
      <div className="border-t border-gray-200 p-3">
        <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-blue-600 rounded-md hover:bg-gray-50">
          
          <span>Bekijk volledige audit log</span>

          <ArrowRight />
          
        </button>
      </div>
    </div>
  );
}
