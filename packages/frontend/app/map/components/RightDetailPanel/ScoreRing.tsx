/**
 * ScoreRing Component
 *
 * Circular progress indicator showing the market score (0-100).
 * Features:
 * - Large readable score number
 * - Color-coded ring (emerald/amber/rose based on score)
 * - Smooth animation on load
 */

interface ScoreRingProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Get ring color based on score value
 */
function getRingColor(score: number): string {
  if (score >= 70) return 'stroke-emerald-500';
  if (score >= 40) return 'stroke-amber-500';
  return 'stroke-rose-500';
}

/**
 * Get score text color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

const SIZES = {
  sm: { svg: 'w-12 h-12', radius: 20, stroke: 4, text: 'text-base', viewBox: 48 },
  md: { svg: 'w-20 h-20', radius: 34, stroke: 6, text: 'text-2xl', viewBox: 80 },
  lg: { svg: 'w-28 h-28', radius: 48, stroke: 8, text: 'text-4xl', viewBox: 112 },
};

export function ScoreRing({ score, size = 'md', showLabel = false }: ScoreRingProps) {
  const config = SIZES[size];
  const circumference = 2 * Math.PI * config.radius;
  const progress = (score / 100) * circumference;
  const center = config.viewBox / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg
          className={`${config.svg} -rotate-90`}
          viewBox={`0 0 ${config.viewBox} ${config.viewBox}`}
        >
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={config.radius}
            fill="none"
            strokeWidth={config.stroke}
            className="stroke-surface-container-highest"
          />
          {/* Progress ring */}
          <circle
            cx={center}
            cy={center}
            r={config.radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            className={`${getRingColor(score)} transition-all duration-700 ease-out`}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{
              transition: 'stroke-dashoffset 0.7s ease-out',
            }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${config.text} ${getScoreColor(score)}`}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-on-surface-variant">out of 100</span>
      )}
    </div>
  );
}
