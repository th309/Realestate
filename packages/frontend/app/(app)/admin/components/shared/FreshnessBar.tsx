interface FreshnessBarProps {
  daysSinceUpdate: number;
  expectedDays: number;
  label?: string;
}

function getFreshnessColor(
  daysSinceUpdate: number,
  expectedDays: number,
): string {
  if (daysSinceUpdate <= expectedDays) return "bg-green-500";
  if (daysSinceUpdate <= expectedDays * 1.5) return "bg-amber-500";
  return "bg-red-500";
}

function getFreshnessLabel(
  daysSinceUpdate: number,
  expectedDays: number,
): string {
  if (daysSinceUpdate <= expectedDays) return "Fresh";
  return `${daysSinceUpdate - expectedDays}d stale`;
}

export function FreshnessBar({
  daysSinceUpdate,
  expectedDays,
  label,
}: FreshnessBarProps) {
  const fillPercent = Math.min(
    (daysSinceUpdate / (expectedDays * 2)) * 100,
    100,
  );
  const barColor = getFreshnessColor(daysSinceUpdate, expectedDays);
  const statusText = getFreshnessLabel(daysSinceUpdate, expectedDays);
  const isFresh = daysSinceUpdate <= expectedDays;

  return (
    <div className="flex items-center gap-2 w-full">
      {label && (
        <span className="text-xs text-on-surface-variant shrink-0 w-24 truncate">
          {label}
        </span>
      )}
      <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <span
        className={`text-xs shrink-0 font-medium ${isFresh ? "text-green-600" : daysSinceUpdate <= expectedDays * 1.5 ? "text-amber-600" : "text-red-600"}`}
      >
        {statusText}
      </span>
    </div>
  );
}
