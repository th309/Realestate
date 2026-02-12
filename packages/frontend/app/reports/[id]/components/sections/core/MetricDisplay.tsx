'use client';

import React from 'react';

import { formatMetricValue, getMetricFormat } from '@/lib/data';

import { TrendSparkline, TrendDirection } from './TrendSparkline';

/**
 * Trend data for displaying metric changes over time
 */
export interface MetricTrend {
  /** Direction of the trend: 'up', 'down', or 'stable' */
  direction: TrendDirection;
  /** Percentage change (e.g., 5.2 for +5.2%) */
  changePct: number;
  /** Data points for the sparkline visualization */
  sparklineData?: number[];
}

export interface MetricDisplayProps {
  /** Unique metric identifier used for formatting lookup */
  metricId: string;
  /** The numeric value to display, or null if unavailable */
  value: number | null;
  /** Label displayed above or below the value */
  label: string;
  /** Optional trend data showing direction, change, and sparkline */
  trend?: MetricTrend;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * MetricDisplay - A shared primitive for displaying a single metric
 *
 * Displays a formatted metric value with its label and optional trend indicator.
 * Uses the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { MetricDisplay } from './core/MetricDisplay';
 *
 * // Basic usage
 * <MetricDisplay
 *   metricId="home_value"
 *   value={525000}
 *   label="Median Home Value"
 * />
 *
 * // With trend data
 * <MetricDisplay
 *   metricId="home_value"
 *   value={525000}
 *   label="Median Home Value"
 *   trend={{
 *     direction: 'up',
 *     changePct: 5.2,
 *     sparklineData: [490000, 495000, 510000, 518000, 525000]
 *   }}
 * />
 *
 * // Null value
 * <MetricDisplay
 *   metricId="home_value"
 *   value={null}
 *   label="Median Home Value"
 * />
 * ```
 */
export function MetricDisplay({
  metricId,
  value,
  label,
  trend,
  className = '',
}: MetricDisplayProps): React.ReactElement {
  const format = getMetricFormat(metricId);

  // Handle null/unavailable data
  if (value === null) {
    return (
      <div className={`report-metric-card ${className}`.trim()}>
        <p className="report-metric-label">{label}</p>
        <p className="report-metric-value" style={{ opacity: 0.4 }}>
          —
        </p>
        <p className="report-body-sm" style={{ marginTop: 'var(--report-space-xs)' }}>
          Data unavailable
        </p>
      </div>
    );
  }

  const formattedValue = formatMetricValue(value, format);

  return (
    <div className={`report-metric-card ${className}`.trim()}>
      <p className="report-metric-label">{label}</p>
      <p className="report-metric-value">{formattedValue}</p>

      {trend && trend.sparklineData && trend.sparklineData.length >= 2 && (
        <div style={{ marginTop: 'var(--report-space-xs)' }}>
          <TrendSparkline
            data={trend.sparklineData}
            trend={trend.direction}
            changePct={trend.changePct}
            width={80}
            height={24}
          />
        </div>
      )}
    </div>
  );
}

export default MetricDisplay;
