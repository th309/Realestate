/**
 * ConfidenceDisplay Component
 *
 * Shows score confidence level with star rating and percentage.
 * Features:
 * - 1-5 star rating based on confidence percentage
 * - Percentage label
 * - Tooltip with explanation
 * - Warning for low confidence
 */

'use client';

import { memo, useState, useRef, useEffect } from 'react';

type ConfidenceLevel = 'a' | 'b' | 'c' | 'f';

interface ConfidenceDisplayProps {
  level: ConfidenceLevel;
  percentage: number;
  metricsAvailable: number;
  metricsTotal: number;
  freshnessInDays: number;
  warning?: string;
  size?: 'sm' | 'md';
  showDetails?: boolean;
  className?: string;
}

/**
 * Get number of filled stars based on percentage
 */
function getStarCount(percentage: number): number {
  if (percentage >= 90) return 5;
  if (percentage >= 80) return 4;
  if (percentage >= 70) return 3;
  if (percentage >= 55) return 2;
  return 1;
}

/**
 * Get color based on confidence level
 */
function getConfidenceColor(level: ConfidenceLevel): {
  text: string;
  star: string;
  bg: string;
  border: string;
} {
  switch (level) {
    case 'a':
      return {
        text: 'text-emerald-600',
        star: 'text-emerald-400',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    case 'b':
      return {
        text: 'text-amber-600',
        star: 'text-amber-400',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
    case 'c':
      return {
        text: 'text-rose-600',
        star: 'text-rose-400',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
      };
    case 'f':
      return {
        text: 'text-red-700',
        star: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-200',
      };
    default:
      return {
        text: 'text-on-surface-variant',
        star: 'text-on-surface-variant',
        bg: 'bg-surface-container',
        border: 'border-outline-variant',
      };
  }
}

/**
 * Star icon component
 */
function StarIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${filled ? color : 'text-surface-container-highest'}`}
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

/**
 * Warning icon for low confidence
 */
function WarningIcon({ className = '' }: { className?: string }) {
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
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/**
 * Get freshness label
 */
function getFreshnessLabel(days: number): string {
  if (days <= 7) return 'Fresh data';
  if (days <= 30) return 'Recent data';
  if (days <= 60) return 'Current data';
  if (days <= 120) return 'Slightly dated';
  return 'Older data';
}

export const ConfidenceDisplay = memo(function ConfidenceDisplay({
  level,
  percentage,
  metricsAvailable,
  metricsTotal,
  freshnessInDays,
  warning,
  size = 'md',
  showDetails = false,
  className = '',
}: ConfidenceDisplayProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');

  // Calculate tooltip position
  useEffect(() => {
    if (showTooltip && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPosition(rect.top < 100 ? 'bottom' : 'top');
    }
  }, [showTooltip]);

  const starCount = getStarCount(percentage);
  const colors = getConfidenceColor(level);
  const isSmall = size === 'sm';

  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">
        Grade {level.toUpperCase()} Confidence ({percentage}%)
      </div>
      <div className="text-gray-300 text-xs">
        <div>{metricsAvailable} of {metricsTotal} metrics available</div>
        <div>{getFreshnessLabel(freshnessInDays)} ({freshnessInDays} days old)</div>
      </div>
      {warning && (
        <div className="text-amber-300 text-xs flex items-center gap-1">
          <WarningIcon className="w-3 h-3" />
          {warning}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`
        relative inline-flex items-center gap-1.5
        ${showDetails ? `px-2 py-1 rounded border ${colors.bg} ${colors.border}` : ''}
        ${className}
      `}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="img"
      aria-label={`${level} confidence: ${percentage}%`}
    >
      {/* Star rating */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <StarIcon key={i} filled={i <= starCount} color={colors.star} />
        ))}
      </div>

      {/* Percentage and label */}
      {showDetails && (
        <>
          <span className={`${isSmall ? 'text-xs' : 'text-sm'} font-medium ${colors.text}`}>
            {percentage}%
          </span>
          {(level === 'c' || level === 'f') && warning && (
            <WarningIcon className={`${colors.text} ${isSmall ? 'w-3 h-3' : 'w-4 h-4'}`} />
          )}
        </>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={`
            absolute left-1/2 -translate-x-1/2 z-50 w-48
            px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg
            ${tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
          `}
          role="tooltip"
        >
          {tooltipContent}
          <span
            className={`
              absolute left-1/2 -translate-x-1/2 border-4 border-transparent
              ${tooltipPosition === 'top' ? 'top-full border-t-gray-900' : 'bottom-full border-b-gray-900'}
            `}
          />
        </div>
      )}
    </div>
  );
});

export default ConfidenceDisplay;
