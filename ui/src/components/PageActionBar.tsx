import 
{ 
  CircleArrowRight,
} from "lucide-react";

type Props = {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
};

export default function PageActionBar({
  onBack,
  onNext,
  backLabel = "Terug",
  nextLabel = "Door naar accordering",
}: Props) {
  return (
    <div className="border-t border-gray-200 mt-6">
      
      {/* CONTENT WRAPPER */}
      <div className="flex items-center justify-between px-6 py-3">

        {/* LEFT */}
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          {backLabel}
        </button>

        {/* RIGHT */}
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          {nextLabel}
          <CircleArrowRight  />
        </button>

      </div>
    </div>
  );
}
