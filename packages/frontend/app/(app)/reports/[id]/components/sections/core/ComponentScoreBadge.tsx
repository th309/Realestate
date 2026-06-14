'use client';

import React from 'react';

import type { ComponentStatus } from '@/lib/data';

export interface ComponentScoreBadgeProps {
  /** Component identifier (e.g. 'affordability', 'market_timing') */
  component: string;
  /** Normalized component score (0-100) */
  score: number;
  /** Human-readable label (e.g. "Affordability") */
  label: string;
  /** Quick-read status label based on score thresholds */
  status: ComponentStatus;
  /** Smaller variant for inline use (~40px ring instead of ~60px) */
  compact?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Maps a ComponentStatus to its corresponding CSS color variable.
 */
function getStatusColor(status: ComponentStatus): string {
  switch (status) {
    case 'excellent':
    case 'strong':
      return 'var(--report-success)';
    case 'moderate':
      return 'var(--report-warning)';
    case 'watch':
    case 'concern':
      return 'var(--report-error)';
    default:
      return 'var(--report-stone)';
  }
}

/**
 * Maps a ComponentStatus to its background CSS color variable.
 */
function getStatusBgColor(status: ComponentStatus): string {
  switch (status) {
    case 'excellent':
    case 'strong':
      return 'var(--report-success-bg)';
    case 'moderate':
      return 'var(--report-warning-bg)';
    case 'watch':
    case 'concern':
      return 'var(--report-error-bg)';
    default:
      return 'var(--report-cream-dark)';
  }
}

/**
 * Capitalizes the first letter of a status string for display.
 */
function formatStatus(status: ComponentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * ComponentScoreBadge - Displays a score component with its score, grade, and status indicator
 *
 * Used at the top of each deep-dive section to show the component score
 * as a small circular ring with the numeric score in the center, a label,
 * and a color-coded status pill.
 *
 * Uses the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { ComponentScoreBadge } from './core/ComponentScoreBadge';
 *
 * <ComponentScoreBadge
 *   component="affordability"
 *   score={72}
 *   label="Affordability"
 *   status="strong"
 * />
 *
 * // Compact variant for inline use
 * <ComponentScoreBadge
 *   component="market_timing"
 *   score={58}
 *   label="Market Timing"
 *   status="moderate"
 *   compact
 * />
 * ```
 */
export function ComponentScoreBadge({
  component,
  score,
  label,
  status,
  compact = false,
  className = '',
}: ComponentScoreBadgeProps): React.ReactElement {
  const color = getStatusColor(status);
  const bgColor = getStatusBgColor(status);

  // Ring dimensions based on variant
  const size = compact ? 40 : 60;
  const strokeWidth = compact ? 3.5 : 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(score, 100) / 100) * circumference;

  return (
    <div
      className={`flex items-center gap-3 ${className}`.trim()}
      role="region"
      aria-label={`${label}: score ${score} out of 100, status ${status}`}
    >
      {/* Score ring */}
      <div
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label} score: ${score}`}
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--report-cream-dark)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
        {/* Score number in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-bold ${compact ? 'text-sm' : 'text-lg'}`}
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            {score}
          </span>
        </div>
      </div>

      {/* Label and status */}
      <div className="flex flex-col gap-1">
        <span
          className={`font-semibold leading-tight ${compact ? 'text-sm' : 'text-base'}`}
          style={{
            fontFamily: 'var(--report-font-display)',
            color: 'var(--report-navy)',
          }}
        >
          {label}
        </span>
        <span
          className={`inline-flex self-start items-center rounded-full font-semibold uppercase tracking-wide ${
            compact
              ? 'px-1.5 py-0.5 text-[0.5625rem]'
              : 'px-2 py-0.5 text-[0.625rem]'
          }`}
          style={{
            backgroundColor: bgColor,
            color: color,
            fontFamily: 'var(--report-font-body)',
          }}
        >
          {formatStatus(status)}
        </span>
      </div>
    </div>
  );
}

export default ComponentScoreBadge;
