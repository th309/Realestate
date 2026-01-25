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

import type { GeoLevel, MapData, MapDataEntry } from '../types';
import { getValueFromEntry } from '../types';
import { getMetricFormat as getFormat, getMetricConfig } from '../config';
import {
  CURRENCY_SCALES,
  PERCENTILE_BOUNDS,
  DEFAULT_VALUE_RANGES,
} from '../config';

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

export interface ValueRangeResult {
  min: number;
  max: number;
  /** When set (e.g. '+'), legend shows max label with this suffix (e.g. "200+") */
  maxLabelSuffix?: string;
}

/**
 * Calculate the value range for color scale mapping.
 * Uses percentile-based calculation to exclude outliers, or fixed scale for permit-type metrics.
 *
 * @param mapData - Object mapping region IDs to values
 * @param metricFormat - The format type of the metric
 * @param metricId - Optional metric ID for special handling
 * @param geoLevel - Optional geography level; when set with scaleForGeos, fixed scale applies only for that level
 * @returns min and max values for the color scale, and optional max label suffix
 */
export function calculateValueRange(
  mapData: MapData,
  metricFormat: ReturnType<typeof getFormat>,
  metricId?: string,
  geoLevel?: GeoLevel
): ValueRangeResult {
  // Extract numeric values from both simple numbers and object entries
  const allValues = Object.values(mapData)
    .map((entry: MapDataEntry) => getValueFromEntry(entry))
    .filter((v): v is number => v !== null && !isNaN(v));

  const defaultRange = DEFAULT_VALUE_RANGES[metricFormat];
  if (allValues.length === 0) {
    return { min: defaultRange.min, max: defaultRange.max };
  }

  const sorted = [...allValues].sort((a, b) => a - b);
  const config = metricId ? getMetricConfig(metricId) : undefined;

  // Fixed scale (e.g. permits 0–200+ at county only) when enabled for this geo level
  const hasFixedScale = config?.scaleMin != null || config?.scaleMax != null;
  const useFixedScale = hasFixedScale && config && (
    !config.scaleForGeos || (geoLevel != null && config.scaleForGeos.includes(geoLevel))
  );
  if (useFixedScale && config) {
    const min = config.scaleMin ?? sorted[0];
    const max = config.scaleMax ?? sorted[sorted.length - 1];
    return {
      min,
      max,
      maxLabelSuffix: config.scaleMax != null ? '+' : undefined,
    };
  }

  // Check if this metric uses full range (no percentile clipping)
  if (config?.rangeType === 'full') {
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }

  if (metricFormat === 'percent') {
    // For growth metrics, use 5th and 95th percentile to exclude outliers
    const p5Index = Math.max(0, Math.floor(sorted.length * PERCENTILE_BOUNDS.MIN));
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * PERCENTILE_BOUNDS.MAX));
    return { min: sorted[p5Index], max: sorted[p95Index] };
  } else if (metricFormat === 'percent_abs') {
    // For absolute percent metrics (0-100%), use data-driven range
    const positiveValues = sorted.filter(v => v >= 0);
    if (positiveValues.length === 0) {
      return { min: defaultRange.min, max: defaultRange.max };
    }
    const p5Index = Math.max(0, Math.floor(positiveValues.length * PERCENTILE_BOUNDS.MIN));
    const p95Index = Math.min(positiveValues.length - 1, Math.floor(positiveValues.length * PERCENTILE_BOUNDS.MAX));
    return { min: positiveValues[p5Index], max: positiveValues[p95Index] };
  } else {
    // For number/days/etc: include zeros so 0 is the bottom of the scale (more variation)
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * PERCENTILE_BOUNDS.MAX));
    return { min: sorted[0], max: sorted[p95Index] };
  }
}

/**
 * Format a value for display based on metric type.
 * Used by both legend labels and hover popups.
 * @param metricId - When provided with position 'max', PropertyIQ (0–100) omits '+' so label shows "100" not "100+".
 */
export function formatValue(
  value: number,
  metricFormat: ReturnType<typeof getFormat>,
  position?: 'min' | 'max',
  metricId?: string
): string {
  const isPropertyIQMax = position === 'max' && metricId && getMetricConfig(metricId)?.dataSource === 'propertyiq';
  const suffix = position === 'max' && !isPropertyIQMax ? '+' : '';

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
    case 'index_1dec':
      return value.toFixed(1) + suffix;
    case 'currency':
    default:
      if (value >= CURRENCY_SCALES.MILLION) {
        return '$' + (value / CURRENCY_SCALES.MILLION).toFixed(1) + 'M' + suffix;
      } else if (value >= CURRENCY_SCALES.THOUSAND) {
        return '$' + Math.round(value / CURRENCY_SCALES.THOUSAND) + 'K' + suffix;
      }
      return '$' + Math.round(value).toLocaleString('en-US') + suffix;
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
    case 'index_1dec':
      displayValue = value > 0 ? value.toFixed(1) : 'No data';
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

// Extended format types for benchmark comparisons
export type BenchmarkFormat = 'currency' | 'percent' | 'days' | 'number' | 'ratio' | 'months';

/**
 * Format a value for benchmark display.
 * Handles additional formats like 'months' and 'ratio' used in BenchmarkPanel.
 * Note: Percentage values are pre-converted by the backend (e.g., -3.82 means -3.82%)
 */
export function formatBenchmarkValue(
  value: number | null | undefined,
  format: BenchmarkFormat
): string {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'currency':
      if (value >= CURRENCY_SCALES.MILLION) return `$${(value / CURRENCY_SCALES.MILLION).toFixed(1)}M`;
      if (value >= CURRENCY_SCALES.THOUSAND) return `$${(value / CURRENCY_SCALES.THOUSAND).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    case 'percent':
      // Values are already in percentage format (e.g., -3.82 = -3.82%)
      // Add + sign for positive values
      const sign = value > 0 ? '+' : '';
      return `${sign}${value.toFixed(1)}%`;
    case 'days':
      return `${Math.round(value)} days`;
    case 'months':
      return `${value.toFixed(1)} mo`;
    case 'number':
      return value.toLocaleString();
    case 'ratio':
      return `${value.toFixed(1)}x`;
    default:
      return String(value);
  }
}
