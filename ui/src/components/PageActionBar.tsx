const ArrowRight = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
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

type Props = {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
};

export default function PageActionBar({
  onBack,
  onNext,
  backLabel = "Terug",
  nextLabel = "Door naar accordering",
  nextDisabled = false,
}: Props) {
  return (
    <div className="border-t border-gray-200 mt-6">
      
      {/* CONTENT WRAPPER */}
      <div className="flex items-center justify-between px-6 py-3">

        {/* LEFT */}
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          {backLabel}
        </button>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextLabel}
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>

      </div>
    </div>
  );
}
