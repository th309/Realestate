/**
 * ScoreProgress Component
 *
 * M3 Linear Progress Indicator showing percentile rank.
 * - 4px height with rounded ends
 * - Color-coded based on theme (purple for homebuyer, emerald for investor)
 */

interface ScoreProgressProps {
  percentile: number; // 0-100, where this region ranks
  color?: 'purple' | 'emerald';
}

export function ScoreProgress({ percentile, color = 'purple' }: ScoreProgressProps) {
  const fillColor = color === 'purple' ? 'bg-purple-500' : 'bg-emerald-500';

  return (
    <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${fillColor} transition-all duration-500 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, percentile))}%` }}
      />
    </div>
  );
}

/**
 * Alternative: ScoreChip for compact spaces
 * Shows just the percentile number in a colored chip
 */
interface ScoreChipProps {
  percentile: number;
}

export function ScoreChip({ percentile }: ScoreChipProps) {
  const bgColor = percentile >= 70
    ? 'bg-emerald-100 text-emerald-700'
    : percentile >= 40
      ? 'bg-amber-100 text-amber-700'
      : 'bg-rose-100 text-rose-700';

  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${bgColor}`}>
      {percentile}
    </span>
  );
}
