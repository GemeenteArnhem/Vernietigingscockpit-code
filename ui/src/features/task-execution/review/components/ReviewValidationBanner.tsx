type Props = {
  count: number;
};

export default function ReviewValidationBanner({ count }: Props) {
  if (count === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="font-medium text-red-700">
        Validatie
      </div>

      <div className="text-sm text-red-600 mt-1">
        {count} record(s) missen een toelichting bij uitsluiting.
      </div>
    </div>
  );
}
