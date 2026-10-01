type Props = {
  count: number;
  hasErrors: boolean;
  onClear: () => void;
  onMarkReviewed: () => void;
};

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      d="M6 6L18 18M18 6L6 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      d="M5 13L10 18L19 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export default function ReviewSelectionBar({
  count,
  hasErrors,
  onClear,
  onMarkReviewed,
}: Props) {
  if (count === 0) return null;

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {count} objecten geselecteerd
        </span>

        <button
          onClick={onClear}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-md text-blue-600 bg-white hover:bg-gray-50"
        >
          Selectie wissen
          <CloseIcon />
        </button>

        <button
          onClick={onMarkReviewed}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Zet op beoordeeld
          <CheckIcon />
        </button>
      </div>

      <div
        className={`flex items-center gap-2 text-sm ${
          hasErrors ? "text-red-600" : "text-green-600"
        }`}
      >
        <CheckIcon />

        <span>
          {hasErrors
            ? "Er zijn fouten in de selectie."
            : "Alle beoordeelde objecten zijn geldig."}
        </span>
      </div>
    </div>
  );
}
