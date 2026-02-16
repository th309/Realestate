'use client';

import React from 'react';

import { formatMetricValue } from '@/lib/data';
import type { MetricFormat } from '@/lib/data';

/**
 * A single metric item with optional benchmark and trend data
 */
export interface MetricItem {
  /** Display label (e.g. "Median Home Value") */
  label: string;
  /** Numeric value, or null if unavailable */
  value: number | null;
  /** Formatting type from the data layer */
  format: MetricFormat;
  /** Optional benchmark comparison (e.g. national or state average) */
  benchmark?: {
    label: string;
    value: number | null;
  };
  /** Optional trend indicator */
  trend?: {
    direction: 'up' | 'down' | 'stable';
    changePct: number;
  };
}

export interface MetricsRowProps {
  /** Array of 3-4 metrics to display in a row */
  metrics: MetricItem[];
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Returns the appropriate arrow character for a trend direction.
 */
function getTrendArrow(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up':
      return '\u2191'; // Up arrow
    case 'down':
      return '\u2193'; // Down arrow
    case 'stable':
    default:
      return '\u2192'; // Right arrow
  }
}

/**
 * Returns the color CSS variable for a trend direction.
 */
function getTrendColor(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up':
      return 'var(--report-success)';
    case 'down':
      return 'var(--report-error)';
    case 'stable':
    default:
      return 'var(--report-stone)';
  }
}

/**
 * Returns the background color CSS variable for a trend direction.
 */
function getTrendBgColor(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up':
      return 'var(--report-success-bg)';
    case 'down':
      return 'var(--report-error-bg)';
    case 'stable':
    default:
      return 'var(--report-cream-dark)';
  }
}

/**
 * MetricsRow - Displays 3-4 metrics in a responsive grid with optional benchmarks and trends
 *
 * Each metric card shows the formatted value prominently with its label below,
 * an optional benchmark comparison, and an optional trend indicator arrow.
 * Layout is 2 columns on mobile, expanding to fill on desktop.
 *
 * Uses `formatMetricValue` from the data layer for consistent formatting and
 * the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { MetricsRow } from './core/MetricsRow';
 *
 * <MetricsRow
 *   metrics={[
 *     {
 *       label: 'Median Home Value',
 *       value: 525000,
 *       format: 'currency',
 *       benchmark: { label: 'National', value: 385000 },
 *       trend: { direction: 'up', changePct: 5.2 },
 *     },
 *     {
 *       label: 'Days on Market',
 *       value: 28,
 *       format: 'days',
 *     },
 *     {
 *       label: 'Price-to-Income',
 *       value: 4.8,
 *       format: 'number',
 *       benchmark: { label: 'State Avg', value: 3.9 },
 *     },
 *   ]}
 * />
 * ```
 */
export function MetricsRow({
  metrics,
  className = '',
}: MetricsRowProps): React.ReactElement {
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-4 gap-[var(--report-space-sm)] ${className}`.trim()}
      role="list"
      aria-label="Key metrics"
    >
      {metrics.map((metric, index) => (
        <div
          key={`${metric.label}-${index}`}
          className="p-[var(--report-space-md)] rounded-[var(--report-radius-md)]"
          style={{
            backgroundColor: 'var(--report-cream)',
            border: '1px solid rgba(27, 46, 74, 0.04)',
          }}
          role="listitem"
        >
          {/* Label */}
          <p
            className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] mb-[var(--report-space-xs)]"
            style={{ color: 'var(--report-stone-light)' }}
          >
            {metric.label}
          </p>

          {/* Value */}
          {metric.value !== null ? (
            <p
              className="text-xl font-semibold tracking-tight"
              style={{
                fontFamily: 'var(--report-font-display)',
                color: 'var(--report-navy)',
                letterSpacing: '-0.02em',
              }}
            >
              {formatMetricValue(metric.value, metric.format)}
            </p>
          ) : (
            <p
              className="text-xl font-semibold"
              style={{
                fontFamily: 'var(--report-font-display)',
                color: 'var(--report-navy)',
                opacity: 0.4,
              }}
            >
              &mdash;
            </p>
          )}

          {/* Trend indicator */}
          {metric.trend && (
            <div className="mt-[var(--report-space-xs)]">
              <span
                className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: getTrendBgColor(metric.trend.direction),
                  color: getTrendColor(metric.trend.direction),
                }}
              >
                <span aria-hidden="true">{getTrendArrow(metric.trend.direction)}</span>
                <span>
                  {metric.trend.changePct >= 0 ? '+' : ''}
                  {metric.trend.changePct.toFixed(1)}%
                </span>
              </span>
            </div>
          )}

          {/* Benchmark comparison */}
          {metric.benchmark && metric.benchmark.value !== null && (
            <p
              className="text-[0.75rem] mt-[var(--report-space-xs)] leading-snug"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {metric.benchmark.label}:{' '}
              <span className="font-medium" style={{ color: 'var(--report-stone)' }}>
                {formatMetricValue(metric.benchmark.value, metric.format)}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default MetricsRow;
