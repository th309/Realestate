/**
 * METRIC VALUE FORMATTING
 *
 * Utilities for formatting metric values based on their format type.
 * Designed to work with the MetricFormat types from the registry.
 */

import type { MetricFormat } from './types';

const CURRENCY_SCALES = {
  MILLION: 1_000_000,
  THOUSAND: 1_000,
} as const;

/**
 * Formats a metric value based on its format type.
 *
 * @param value - The numeric value to format
 * @param format - The metric format type
 * @param options - Optional formatting options
 * @returns Formatted string
 */
export function formatMetricValue(
  value: number | null | undefined,
  format: MetricFormat,
  options: {
    position?: 'min' | 'max';
    isPropertyIQ?: boolean;
  } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  const { position, isPropertyIQ = false } = options;
  const isPropertyIQMax = position === 'max' && isPropertyIQ;
  const suffix = position === 'max' && !isPropertyIQMax ? '+' : '';

  switch (format) {
    case 'percent': {
      const sign = value > 0 ? '+' : '';
      return sign + value.toFixed(1) + '%';
    }

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
      return '$' + value.toLocaleString('en-US') + suffix;
  }
}

/**
 * Formats a percent change value with sign.
 *
 * @param change - The percent change value
 * @param precision - Number of decimal places
 * @returns Formatted change string with sign
 */
export function formatPercentChange(
  change: number | null | undefined,
  precision: number = 1
): string {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return '—';
  }

  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(precision)}%`;
}

/**
 * Gets the trend direction from a change value.
 *
 * @param change - The change value
 * @returns Direction string
 */
export function getTrendDirection(
  change: number | null | undefined
): 'up' | 'down' | 'flat' {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return 'flat';
  }
  if (change > 0.01) return 'up';
  if (change < -0.01) return 'down';
  return 'flat';
}
