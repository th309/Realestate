/**
 * Value Formatting Utilities
 *
 * Provides consistent formatting for metric values across the application.
 * Used by data cards, charts, and statistics displays.
 */

export type FormatType =
  | 'currency'
  | 'percent'
  | 'number'
  | 'decimal'
  | 'years'
  | 'days'
  | 'ratio'
  | 'index';

export interface FormatOptions {
  format: FormatType;
  precision?: number;
  prefix?: string;
  suffix?: string;
}

/**
 * Formats a numeric value based on the specified format type.
 *
 * @param value - The numeric value to format
 * @param options - Formatting options including type, precision, and affixes
 * @returns Formatted string representation of the value
 *
 * @example
 * formatValue(425000, { format: 'currency', precision: 0 }) // "$425,000"
 * formatValue(5.25, { format: 'percent', precision: 2 }) // "5.25%"
 * formatValue(28, { format: 'days', precision: 0, suffix: ' days' }) // "28 days"
 */
export function formatValue(
  value: number | null | undefined,
  options: FormatOptions
): string {
  // Handle null/undefined/NaN
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }

  const { format, precision = 0, prefix = '', suffix = '' } = options;

  let formatted: string;

  switch (format) {
    case 'currency':
      formatted = formatCurrency(value, precision);
      break;
    case 'percent':
      formatted = formatPercent(value, precision);
      break;
    case 'number':
      formatted = formatNumber(value, precision);
      break;
    case 'decimal':
      formatted = formatDecimal(value, precision);
      break;
    case 'years':
      formatted = formatYears(value, precision);
      break;
    case 'days':
      formatted = formatDays(value, precision);
      break;
    case 'ratio':
      formatted = formatRatio(value, precision);
      break;
    case 'index':
      formatted = formatIndex(value, precision);
      break;
    default:
      formatted = value.toFixed(precision);
  }

  return `${prefix}${formatted}${suffix}`;
}

/**
 * Formats a value as US currency.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 0)
 * @returns Formatted currency string (e.g., "$425,000")
 */
export function formatCurrency(value: number, precision: number = 0): string {
  if (Number.isNaN(value)) return 'N/A';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

/**
 * Formats a value as US currency with abbreviations for large numbers.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places for abbreviated values (default 1)
 * @returns Abbreviated currency string (e.g., "$15.0M", "$1.5B")
 */
export function formatCurrencyAbbreviated(
  value: number,
  precision: number = 1
): string {
  if (Number.isNaN(value)) return 'N/A';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}$${(absValue / 1_000_000_000).toFixed(precision)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(precision)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(precision)}K`;
  }

  return formatCurrency(value, precision);
}

/**
 * Formats a value as a percentage.
 *
 * @param value - The numeric value (e.g., 5.25 for 5.25%)
 * @param precision - Number of decimal places (default 2)
 * @returns Formatted percentage string (e.g., "5.25%")
 */
export function formatPercent(value: number, precision: number = 2): string {
  if (Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(precision)}%`;
}

/**
 * Formats a value with thousands separators.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 0)
 * @returns Formatted number string (e.g., "1,234,567")
 */
export function formatNumber(value: number, precision: number = 0): string {
  if (Number.isNaN(value)) return 'N/A';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

/**
 * Formats a value as a decimal number.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 2)
 * @returns Formatted decimal string (e.g., "3.14")
 */
export function formatDecimal(value: number, precision: number = 2): string {
  if (Number.isNaN(value)) return 'N/A';
  return value.toFixed(precision);
}

/**
 * Formats a value as years.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 1)
 * @returns Formatted years string (e.g., "5.5" or "1")
 */
export function formatYears(value: number, precision: number = 1): string {
  if (Number.isNaN(value)) return 'N/A';
  return value.toFixed(precision);
}

/**
 * Formats a value as days.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 0)
 * @returns Formatted days string (e.g., "28")
 */
export function formatDays(value: number, precision: number = 0): string {
  if (Number.isNaN(value)) return 'N/A';
  return value.toFixed(precision);
}

/**
 * Formats a value as a ratio.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 2)
 * @returns Formatted ratio string (e.g., "0.95")
 */
export function formatRatio(value: number, precision: number = 2): string {
  if (Number.isNaN(value)) return 'N/A';
  return value.toFixed(precision);
}

/**
 * Formats a value as an index number.
 *
 * @param value - The numeric value
 * @param precision - Number of decimal places (default 1)
 * @returns Formatted index string (e.g., "100.5")
 */
export function formatIndex(value: number, precision: number = 1): string {
  if (Number.isNaN(value)) return 'N/A';
  return value.toFixed(precision);
}

/**
 * Formats a percentage change with appropriate sign and color indication.
 *
 * @param value - The change value
 * @param precision - Number of decimal places (default 1)
 * @returns Object with formatted string and direction
 */
export function formatChange(
  value: number | null | undefined,
  precision: number = 1
): { formatted: string; direction: 'up' | 'down' | 'neutral' } {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { formatted: 'N/A', direction: 'neutral' };
  }

  const direction: 'up' | 'down' | 'neutral' =
    value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';

  const sign = value > 0 ? '+' : '';
  const formatted = `${sign}${value.toFixed(precision)}%`;

  return { formatted, direction };
}

/**
 * Gets the appropriate trend color based on direction and metric type.
 *
 * @param direction - The trend direction
 * @param colorScale - The color scale type ('red-green' means up is good, 'green-red' means down is good)
 * @returns CSS class name for the color
 */
export function getTrendColor(
  direction: 'up' | 'down' | 'neutral',
  colorScale: 'red-green' | 'green-red' | 'neutral' = 'red-green'
): string {
  if (direction === 'neutral') {
    return 'text-gray-500';
  }

  if (colorScale === 'red-green') {
    // Up is good (e.g., home values, income)
    return direction === 'up' ? 'text-green-600' : 'text-red-600';
  } else if (colorScale === 'green-red') {
    // Down is good (e.g., unemployment, days on market)
    return direction === 'down' ? 'text-green-600' : 'text-red-600';
  }

  return 'text-gray-500';
}
