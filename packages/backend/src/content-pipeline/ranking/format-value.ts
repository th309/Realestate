/**
 * Format-aware value formatter for ranking entries.
 *
 * Mirrors the frontend formatValue() logic but for the backend ranking
 * resolver, so value_formatted strings are consistent across contexts.
 */

export type MetricFormat =
  | 'currency'
  | 'percent'
  | 'percent_abs'
  | 'number'
  | 'index'
  | 'days';

/**
 * Format a numeric metric value for display in a ranking entry.
 *
 * @param value - The raw numeric value
 * @param format - The metric's display format
 * @returns Human-readable string (e.g. '$1.2M', '12.4%', '28 days')
 */
export function formatRankingValue(
  value: number,
  format: MetricFormat,
): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value * 100);
    case 'percent_abs':
      return formatPercent(value);
    case 'number':
      return formatNumber(value);
    case 'index':
      return String(Math.round(value));
    case 'days':
      return `${Math.round(value)} days`;
  }
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}$${+(abs / 1_000_000_000).toPrecision(3)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${+(abs / 1_000_000).toPrecision(3)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${+(abs / 1_000).toPrecision(3)}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}${+(abs / 1_000_000_000).toPrecision(3)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${+(abs / 1_000_000).toPrecision(3)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${+(abs / 1_000).toPrecision(3)}K`;
  }
  return `${sign}${Math.round(abs)}`;
}
