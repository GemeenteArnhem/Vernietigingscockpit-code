type Props = {
  percentage: number;
  stap: string;
  dagen: number;
  vertraagd?: boolean;
};

export default function TaskProgress({
  percentage,
  stap,
  dagen,
  vertraagd,
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">
        {stap}
      </span>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`
            h-full rounded-full
            ${
              vertraagd
                ? "bg-orange-500"
                : "bg-blue-600"
            }
          `}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <span className="text-xs text-gray-500">
        {percentage}% ({dagen}d in stap)
      </span>
    </div>
  );
}