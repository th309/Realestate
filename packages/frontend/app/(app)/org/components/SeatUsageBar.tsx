"use client";

interface SeatUsageBarProps {
  used: number;
  total: number;
}

/**
 * Visual bar showing seat usage with color-coded fill.
 * Green when under 80%, amber at 80-95%, red above 95%.
 */
export function SeatUsageBar({ used, total }: SeatUsageBarProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  const fillColor =
    percentage > 95
      ? "bg-red-500"
      : percentage >= 80
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full rounded-full bg-surface-container">
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-sm text-on-surface-variant">
        {used} of {total} seats used
      </p>
    </div>
  );
}
