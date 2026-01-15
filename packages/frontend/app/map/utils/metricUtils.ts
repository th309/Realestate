/**
 * Shared Metric Utilities
 *
 * Uses the central metric configuration from config/metrics.ts.
 * This file provides:
 * - Color scale constants
 * - Value range calculation
 * - Value formatting
 *
 * Re-exports getMetricFormat and getMetricTitle from central config for convenience.
 */

import type { HomeValues, HomeValueEntry } from '../types';
import { getValueFromEntry } from '../types';
import { getMetricFormat as getFormat, getMetricTitle as getTitle, getMetricConfig } from '../config';

// Re-export from central config for convenience
export { getMetricFormat, getMetricTitle, type MetricFormat } from '../config';

// Shared color scale - violet to red (7 colors)
// Used by both map fills and legend display
export const COLOR_SCALE = [
  '#7c3aed', // Violet (cool - lowest)
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#f97316', // Orange
  '#ef4444', // Red
  '#b91c1c', // Dark red (hot - highest)
] as const;

// No data color (light gray with transparency)
export const NO_DATA_COLOR = 'rgba(200, 200, 200, 0.3)';

/**
 * Calculate the value range for color scale mapping.
 * Uses percentile-based calculation to exclude outliers.
 *
 * @param homeValues - Object mapping region IDs to values
 * @param metricFormat - The format type of the metric
 * @param metricId - Optional metric ID for special handling
 * @returns min and max values for the color scale
 */
export function calculateValueRange(
  homeValues: HomeValues,
  metricFormat: ReturnType<typeof getFormat>,
  metricId?: string
): { min: number; max: number } {
  // Default ranges based on metric type
  const defaults: Record<ReturnType<typeof getFormat>, { min: number; max: number }> = {
    percent: { min: -5, max: 10 },
    percent_abs: { min: 0, max: 100 },
    days: { min: 0, max: 90 },
    number: { min: 0, max: 10000 },
    index: { min: 0, max: 100 },
    currency: { min: 100000, max: 800000 },
  };

  // Extract numeric values from both simple numbers and object entries
  const allValues = Object.values(homeValues)
    .map((entry: HomeValueEntry) => getValueFromEntry(entry))
    .filter((v): v is number => v !== null && !isNaN(v));

  if (allValues.length === 0) {
    return defaults[metricFormat];
  }

  const sorted = [...allValues].sort((a, b) => a - b);

  // Check if this metric uses full range (no percentile clipping)
  const config = metricId ? getMetricConfig(metricId) : undefined;
  if (config?.rangeType === 'full') {
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }

  if (metricFormat === 'percent') {
    // For growth metrics, use 5th and 95th percentile to exclude outliers
    const p5Index = Math.max(0, Math.floor(sorted.length * 0.05));
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return { min: sorted[p5Index], max: sorted[p95Index] };
  } else if (metricFormat === 'percent_abs') {
    // For absolute percent metrics (0-100%), use data-driven range
    const positiveValues = sorted.filter(v => v >= 0);
    if (positiveValues.length === 0) {
      return defaults[metricFormat];
    }
    const p5Index = Math.max(0, Math.floor(positiveValues.length * 0.05));
    const p95Index = Math.min(positiveValues.length - 1, Math.floor(positiveValues.length * 0.95));
    return { min: positiveValues[p5Index], max: positiveValues[p95Index] };
  } else {
    // For non-percent metrics, use min and 95th percentile of positive values
    const positiveValues = sorted.filter(v => v > 0);
    if (positiveValues.length === 0) {
      return defaults[metricFormat];
    }
    const p95Index = Math.min(positiveValues.length - 1, Math.floor(positiveValues.length * 0.95));
    return { min: positiveValues[0], max: positiveValues[p95Index] };
  }
}

/**
 * Format a value for display based on metric type.
 * Used by both legend labels and hover popups.
 */
export function formatValue(
  value: number,
  metricFormat: ReturnType<typeof getFormat>,
  position?: 'min' | 'max'
): string {
  const suffix = position === 'max' ? '+' : '';

  switch (metricFormat) {
    case 'percent':
      const sign = value > 0 ? '+' : '';
      return sign + value.toFixed(1) + '%';
    case 'percent_abs':
      // Absolute percent (0-100%) - no +/- sign
      return value.toFixed(1) + '%';
    case 'number':
      return value.toLocaleString('en-US') + suffix;
    case 'days':
      return value.toLocaleString('en-US') + ' days';
    case 'index':
      return value.toFixed(0) + suffix;
    case 'currency':
    default:
      if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(1) + 'M' + suffix;
      } else if (value >= 1000) {
        return '$' + Math.round(value / 1000) + 'K' + suffix;
      }
      return '$' + value.toLocaleString('en-US') + suffix;
  }
}

/**
 * Format a value for tooltip display based on metric format.
 * Returns both the formatted string and appropriate color.
 */
export function formatTooltipValue(
  value: number | null,
  metricFormat: ReturnType<typeof getFormat>
): { displayValue: string; valueColor: string } {
  // Handle null (no data) case
  if (value === null || value === undefined) {
    return { displayValue: 'No data', valueColor: '#6b7280' };
  }

  let displayValue: string;
  let valueColor = '#6750a4';

  switch (metricFormat) {
    case 'percent':
      const sign = value > 0 ? '+' : '';
      displayValue = `${sign}${value.toFixed(1)}%`;
      valueColor = value > 0 ? '#b91c1c' : value < 0 ? '#3b82f6' : '#6b7280';
      break;
    case 'percent_abs':
      displayValue = `${value.toFixed(1)}%`;
      break;
    case 'index':
      displayValue = value > 0 ? value.toFixed(0) : 'No data';
      valueColor = value >= 100 ? '#b91c1c' : '#3b82f6';
      break;
    case 'number':
      displayValue = value >= 0 ? value.toLocaleString('en-US') : 'No data';
      break;
    case 'days':
      displayValue = value >= 0 ? `${value.toLocaleString('en-US')} days` : 'No data';
      break;
    case 'currency':
    default:
      displayValue = value > 0
        ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : 'No data';
      break;
  }

  return { displayValue, valueColor };
}

/**
 * Format a date for "as of" display in tooltips.
 * Converts "2025-11-30" to "Nov 2025"
 */
export function formatAsOfDate(dateStr: string | undefined): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `as of ${month} ${year}`;
  } catch {
    return '';
  }
}
