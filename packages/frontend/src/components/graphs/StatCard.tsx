/**
 * StatCard Component
 *
 * Displays a single statistic with a label and formatted value.
 * Used in data cards to show Current, Average, Min, Max values.
 */

'use client';

import React from 'react';

export interface StatCardProps {
  /** The label for the statistic (e.g., "Current", "Average") */
  label: string;
  /** The formatted value to display */
  value: string;
  /** Optional subtext to display below the value */
  subtext?: string;
  /** Optional trend indicator */
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  /** Whether the card is in a loading state */
  loading?: boolean;
  /** Error message to display */
  error?: string;
  /** Callback for retry button when in error state */
  onRetry?: () => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Gets the trend arrow icon based on direction.
 */
function TrendArrow({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  if (direction === 'up') {
    return (
      <svg
        data-testid="trend-arrow-up"
        className="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg
        data-testid="trend-arrow-down"
        className="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      data-testid="trend-arrow-neutral"
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Gets the color class for trend based on direction.
 * By default, up is green and down is red.
 */
function getTrendColorClass(
  direction: 'up' | 'down' | 'neutral',
  invertColors: boolean = false
): string {
  if (direction === 'neutral') return 'text-gray-500';

  if (invertColors) {
    // For metrics where down is good (e.g., unemployment, days on market)
    return direction === 'down' ? 'text-green-600' : 'text-red-600';
  }

  // Default: up is good (e.g., home values, income)
  return direction === 'up' ? 'text-green-600' : 'text-red-600';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend,
  loading = false,
  error,
  onRetry,
  className = '',
}) => {
  // Loading state
  if (loading) {
    return (
      <div
        data-testid="stat-card-loading"
        className={`bg-gray-50 rounded-lg p-4 animate-pulse ${className}`}
      >
        <div className="h-4 bg-gray-200 rounded w-16 mb-2" />
        <div className="h-6 bg-gray-200 rounded w-24" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        data-testid="stat-card-error"
        className={`bg-red-50 rounded-lg p-4 ${className}`}
      >
        <div className="text-sm text-red-600">{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs text-red-700 underline hover:no-underline"
            data-testid="stat-card-retry"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="stat-card"
      className={`bg-gray-50 rounded-lg p-4 ${className}`}
    >
      <div className="text-sm text-gray-500" data-testid="stat-card-label">
        {label}
      </div>
      <div
        className="text-lg font-semibold text-gray-900 mt-1"
        data-testid="stat-card-value"
      >
        {value}
      </div>
      {subtext && (
        <div
          className="text-xs text-gray-500 mt-1"
          data-testid="stat-card-subtext"
        >
          {subtext}
        </div>
      )}
      {trend && (
        <div
          className={`flex items-center gap-1 mt-1 ${getTrendColorClass(trend.direction)}`}
          data-testid="stat-card-trend"
        >
          <TrendArrow direction={trend.direction} />
          <span className="text-sm">{trend.value}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
