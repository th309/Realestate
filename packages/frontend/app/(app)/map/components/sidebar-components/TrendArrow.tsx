/**
 * TrendArrow Component
 *
 * Displays a trend indicator with arrow and optional value.
 * Uses M3 design principles with semantic colors.
 */

import { TrendUpSmallIcon, TrendDownSmallIcon, TrendFlatIcon } from '../Icons';

export type TrendDirection = 'up' | 'down' | 'flat';

interface TrendArrowProps {
  direction: TrendDirection;
  value?: string; // e.g., "3.2 pts", "5%"
  label?: string; // e.g., "vs avg", "YoY"
  invertColors?: boolean; // For metrics where down is good (e.g., days on market)
  size?: 'sm' | 'md';
}

export function TrendArrow({ direction, value, label, invertColors = false, size = 'sm' }: TrendArrowProps) {
  // Determine color based on direction and whether to invert
  const isPositive = invertColors ? direction === 'down' : direction === 'up';
  const isNegative = invertColors ? direction === 'up' : direction === 'down';

  const colorClass = isPositive
    ? 'text-emerald-600'
    : isNegative
      ? 'text-rose-600'
      : 'text-on-surface-variant';

  const Icon = direction === 'up'
    ? TrendUpSmallIcon
    : direction === 'down'
      ? TrendDownSmallIcon
      : TrendFlatIcon;

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass} ${textSize}`}>
      <Icon />
      {value && <span className="font-medium">{value}</span>}
      {label && <span className="text-on-surface-variant">{label}</span>}
    </span>
  );
}

/**
 * Get trend direction from a numeric change value
 */
export function getTrendDirection(change: number, threshold = 0.01): TrendDirection {
  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'flat';
}

/**
 * Format trend value for display
 */
export function formatTrendValue(value: number, format: 'percent' | 'points' | 'number' = 'percent'): string {
  const absValue = Math.abs(value);

  switch (format) {
    case 'percent':
      return `${absValue.toFixed(1)}%`;
    case 'points':
      return `${absValue.toFixed(1)} pts`;
    case 'number':
      return absValue.toLocaleString();
    default:
      return absValue.toString();
  }
}
