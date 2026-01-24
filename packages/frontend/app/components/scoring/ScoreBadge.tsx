/**
 * ScoreBadge Component
 *
 * Circular badge displaying a PropertyIQ score (0-100).
 * Features:
 * - Color-coded ring based on score (green/amber/red)
 * - Trend arrow indicator (up/down/stable)
 * - Lock icon for teaser access mode
 * - Click to expand to full ScoreCard
 *
 * Used for Market Health, HomeReady, and InvestorEdge scores.
 */

'use client';

import { memo } from 'react';
import { MARKET_THRESHOLDS } from './ScoreDisplay';

export type ScoreType = 'market_health' | 'homeready' | 'investoredge';
export type ScoreAccess = 'full' | 'teaser';
export type TrendDirection = 'up' | 'down' | 'stable';
export type ScoreStatus = 'complete' | 'partial' | 'unavailable';

interface ScoreBadgeProps {
  type: ScoreType;
  label: string;
  score: number | null;
  trend: TrendDirection;
  trendChange?: number;
  access: ScoreAccess;
  status: ScoreStatus;
  statusMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showLabel?: boolean;
  className?: string;
}

/**
 * Get ring color based on score value
 */
function getRingColor(score: number | null): string {
  if (score === null) return 'stroke-surface-container-highest';
  if (score >= 70) return 'stroke-emerald-500';
  if (score >= 40) return 'stroke-amber-500';
  return 'stroke-rose-500';
}

/**
 * Get score text color based on value
 */
function getScoreColor(score: number | null): string {
  if (score === null) return 'text-on-surface-variant';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

/**
 * Get background color for the score type
 */
function getTypeColor(type: ScoreType): string {
  switch (type) {
    case 'market_health':
      return 'bg-blue-50 border-blue-200';
    case 'homeready':
      return 'bg-purple-50 border-purple-200';
    case 'investoredge':
      return 'bg-emerald-50 border-emerald-200';
    default:
      return 'bg-surface-container border-outline-variant';
  }
}

/**
 * Get label color for the score type
 */
function getTypeLabelColor(type: ScoreType): string {
  switch (type) {
    case 'market_health':
      return 'text-blue-700';
    case 'homeready':
      return 'text-purple-700';
    case 'investoredge':
      return 'text-emerald-700';
    default:
      return 'text-on-surface-variant';
  }
}

/**
 * Get trend arrow icon
 */
function TrendArrow({ direction, change }: { direction: TrendDirection; change?: number }) {
  if (direction === 'stable') {
    return (
      <span className="text-on-surface-variant text-xs">→</span>
    );
  }

  const isUp = direction === 'up';
  const color = isUp ? 'text-emerald-600' : 'text-rose-600';
  const arrow = isUp ? '↑' : '↓';

  return (
    <span className={`${color} text-xs font-medium flex items-center gap-0.5`}>
      {arrow}
      {change !== undefined && Math.abs(change) > 0.1 && (
        <span>{Math.abs(change).toFixed(1)}</span>
      )}
    </span>
  );
}

/**
 * Lock icon for teaser mode
 */
function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

const SIZES = {
  sm: { svg: 'w-12 h-12', radius: 20, stroke: 3, text: 'text-sm', viewBox: 48, label: 'text-[10px]' },
  md: { svg: 'w-16 h-16', radius: 28, stroke: 4, text: 'text-lg', viewBox: 64, label: 'text-xs' },
  lg: { svg: 'w-20 h-20', radius: 34, stroke: 5, text: 'text-2xl', viewBox: 80, label: 'text-sm' },
};

/**
 * Calculate tick mark positions for market thresholds
 */
const getTickMarkPoints = (
  percentage: number,
  cx: number,
  cy: number,
  radius: number,
  tickLength: number
): { x1: number; y1: number; x2: number; y2: number } => {
  const angle = (percentage / 100) * 2 * Math.PI;
  const dirX = Math.sin(angle);
  const dirY = -Math.cos(angle);
  const innerRadius = radius - tickLength / 2;
  const outerRadius = radius + tickLength / 2;
  return {
    x1: cx + dirX * innerRadius,
    y1: cy - dirY * innerRadius,
    x2: cx + dirX * outerRadius,
    y2: cy - dirY * outerRadius,
  };
};

export const ScoreBadge = memo(function ScoreBadge({
  type,
  label,
  score,
  trend,
  trendChange,
  access,
  status,
  statusMessage,
  size = 'md',
  onClick,
  showLabel = true,
  className = '',
}: ScoreBadgeProps) {
  const config = SIZES[size];
  const circumference = 2 * Math.PI * config.radius;
  const progress = score !== null ? (score / 100) * circumference : 0;
  const center = config.viewBox / 2;
  const isTeaser = access === 'teaser';
  const isUnavailable = status === 'unavailable';

  // Tick mark calculations
  const tickLength = config.stroke * 1.8;
  const tickWidth = Math.max(1, config.stroke / 4);
  const tick33 = getTickMarkPoints(MARKET_THRESHOLDS.sellersMax, center, center, config.radius, tickLength);
  const tick66 = getTickMarkPoints(MARKET_THRESHOLDS.balancedMax, center, center, config.radius, tickLength);

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200
        ${getTypeColor(type)}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : 'cursor-default'}
        ${className}
      `}
      title={statusMessage || label}
    >
      {/* Score Ring */}
      <div className="relative">
        <svg
          className={config.svg}
          viewBox={`0 0 ${config.viewBox} ${config.viewBox}`}
        >
          {/* Rotated group for circles (clockwise from top) */}
          <g style={{ transform: 'rotate(-90deg) scaleX(-1)', transformOrigin: 'center' }}>
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
            />
          </g>

          {/* Tick marks at 33% and 66% (not rotated) */}
          <line
            x1={tick33.x1} y1={tick33.y1} x2={tick33.x2} y2={tick33.y2}
            stroke="#6b7280" strokeWidth={tickWidth} strokeLinecap="round"
          />
          <line
            x1={tick66.x1} y1={tick66.y1} x2={tick66.x2} y2={tick66.y2}
            stroke="#6b7280" strokeWidth={tickWidth} strokeLinecap="round"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isTeaser ? (
            <LockIcon className="text-on-surface-variant" />
          ) : isUnavailable ? (
            <span className="text-on-surface-variant">--</span>
          ) : (
            <span className={`font-bold ${config.text} ${getScoreColor(score)}`}>
              {score}
            </span>
          )}
        </div>
      </div>

      {/* Label and trend */}
      {showLabel && (
        <div className="flex flex-col items-center gap-0.5">
          <span className={`${config.label} font-medium ${getTypeLabelColor(type)} leading-tight text-center`}>
            {label}
          </span>
          {!isTeaser && !isUnavailable && (
            <TrendArrow direction={trend} change={trendChange} />
          )}
          {isTeaser && (
            <span className="text-[10px] text-purple-600 font-semibold px-1 py-0.5 bg-purple-100 rounded">
              PRO
            </span>
          )}
          {status === 'partial' && (
            <span className="text-[10px] text-amber-600">Partial</span>
          )}
        </div>
      )}
    </button>
  );
});

export default ScoreBadge;
