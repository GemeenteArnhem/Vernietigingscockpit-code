type Props = {
  naam: string;
  status: string;
};

export default function TaskHeader({ naam, status }: Props) {
  return (
    <div className="flex items-start justify-between">
      
      {/* LINKS */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            {naam}
          </h1>

          {/* subtiele badge */}
          <span className="px-2.5 py-0.5 text-sm rounded-md border border-blue-200 bg-blue-50 text-blue-600">
            {status}
          </span>
        </div>

        {/* subtitel (1x!) */}
        <p className="text-gray-500 text-sm mt-1">
          Je beoordeelt de vernietigingslijst.
        </p>
      </div>

      {/* RECHTS */}
      <div className="flex items-center gap-3 pt-1">
        
        {/* ghost button FIXED */}
        <button className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
          Taak details
          <span className="text-gray-400 text-xs">ⓘ</span>
        </button>

        {/* primary CTA */}
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
          Door naar accordering
          <span className="text-white/80">→</span>
        </button>
      </div>
    </div>
  );
}