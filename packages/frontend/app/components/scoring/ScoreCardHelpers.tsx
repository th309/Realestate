/**
 * ScoreCard Helper Components
 *
 * Extracted from ScoreCard.tsx to keep the main component under the
 * 400-line hard limit. Contains the history sparkline SVG and close icon.
 */

interface HistoryPoint {
  date: string;
  score: number | null;
}

/**
 * Sparkline chart for score history — renders an inline SVG polyline
 * colored by overall trend direction (up = green, down = red, flat = gray).
 */
export function HistorySparkline({
  data,
  className = "",
}: {
  data: HistoryPoint[];
  className?: string;
}) {
  const validPoints = data.filter((p) => p.score !== null);
  if (validPoints.length < 2) return null;

  const scores = validPoints.map((p) => p.score as number);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const width = 120;
  const height = 32;
  const padding = 4;

  const points = validPoints
    .map((p, i) => {
      const x =
        padding + (i / (validPoints.length - 1)) * (width - 2 * padding);
      const y =
        height -
        padding -
        (((p.score as number) - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  const lastScore = scores[scores.length - 1];
  const firstScore = scores[0];
  const isUp = lastScore > firstScore;
  const strokeColor = isUp
    ? "var(--color-emerald-500, #10b981)"
    : lastScore < firstScore
      ? "var(--color-rose-500, #f43f5e)"
      : "var(--color-gray-500, #6b7280)";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs text-on-surface-variant">
        {validPoints.length}mo
      </span>
    </div>
  );
}

/**
 * Close button icon (X mark)
 */
export function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-5 h-5 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
