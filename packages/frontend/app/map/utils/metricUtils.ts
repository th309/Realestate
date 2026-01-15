/**
 * Shared Metric Utilities
 *
 * Central source of truth for metric formatting, color scales, and range calculations.
 * Both map layers and legend components import from here to ensure consistency.
 */

import type { HomeValues } from '../types';

// Display format types for metrics
// 'percent' = growth rates with +/- signs (YoY, forecasts)
// 'percent_abs' = absolute 0-100% values (affordability, rates)
export type MetricFormat = 'currency' | 'percent' | 'percent_abs' | 'number' | 'index' | 'days';

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
 * Map metric IDs to their display format.
 * This is the single source of truth for how each metric should be formatted.
 * Adding a new metric here automatically updates both map and legend.
 */
export function getMetricFormat(metricId: string): MetricFormat {
  // Percent format - forecasts, growth rates (can be negative, show +/- signs)
  const percentMetrics = [
    'home_price_forecast', 'home_value_yoy', 'home_value_mom', 'home_value_5yr',
    'inventory_yoy', 'sales_yoy',
    'rent_growth', 'population_growth', 'income_growth', 'job_growth', 'gdp_growth',
    'overvalued_pct',
  ];

  // Absolute percent format - 0-100% values (no +/- signs)
  const percentAbsMetrics = [
    'homeowner_affordability', 'renter_affordability', 'homeownership_rate',
    'vacancy_rate', 'price_cut_pct', 'sale_to_list',
    'cap_rate', 'gross_yield', 'rent_to_price',
  ];

  // Plain number format - counts, scores
  const numberMetrics = [
    'for_sale_inventory', 'new_listings', 'pending_listings', 'home_sales',
    'new_construction_sales', 'population', 'median_age',
    'long_term_growth', 'market_health', 'investment_score',
  ];

  // Days format
  const daysMetrics = [
    'days_on_market', 'days_to_close',
  ];

  // Index format (plain number, but semantically different)
  const indexMetrics = [
    'rent_for_houses', 'cost_of_living', 'market_heat',
  ];

  // Years format (treat as number)
  const yearsMetrics = [
    'years_to_save',
  ];

  if (percentMetrics.includes(metricId)) return 'percent';
  if (percentAbsMetrics.includes(metricId)) return 'percent_abs';
  if (numberMetrics.includes(metricId)) return 'number';
  if (daysMetrics.includes(metricId)) return 'days';
  if (indexMetrics.includes(metricId)) return 'index';
  if (yearsMetrics.includes(metricId)) return 'number';

  // Default to currency for home values, prices, rent, income
  return 'currency';
}

/**
 * Calculate the value range for color scale mapping.
 * Uses percentile-based calculation to exclude outliers.
 *
 * @param homeValues - Object mapping region IDs to values
 * @param metricFormat - The format type of the metric
 * @returns min and max values for the color scale
 */
export function calculateValueRange(
  homeValues: HomeValues,
  metricFormat: MetricFormat
): { min: number; max: number } {
  // Default ranges based on metric type
  const defaults: Record<MetricFormat, { min: number; max: number }> = {
    percent: { min: -5, max: 10 },
    percent_abs: { min: 0, max: 100 },
    days: { min: 0, max: 90 },
    number: { min: 0, max: 10000 },
    index: { min: 0, max: 200 },
    currency: { min: 100000, max: 800000 },
  };

  const allValues = Object.values(homeValues).filter(
    (v): v is number => typeof v === 'number' && !isNaN(v)
  );

  if (allValues.length === 0) {
    return defaults[metricFormat];
  }

  const sorted = [...allValues].sort((a, b) => a - b);

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
  metricFormat: MetricFormat,
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
 * Get metric display title.
 */
export function getMetricTitle(metricId: string, forecastHorizon?: string): string {
  const titles: Record<string, string> = {
    'home_value': 'Home Value',
    'home_price_forecast': forecastHorizon === '1m' ? '1-Month Forecast'
      : forecastHorizon === '3m' ? '3-Month Forecast' : '12-Month Forecast',
    'home_value_yoy': 'Home Value YoY',
    'home_value_mom': 'Home Value MoM',
    'home_value_5yr': '5-Year Growth (CAGR)',
    'rent_index': 'Rent Index',
    'rent_for_houses': 'Renter Demand Index',
    'for_sale_inventory': 'Inventory',
    'days_on_market': 'Days on Market',
    'days_to_close': 'Days to Close',
    'overvalued_pct': 'Overvalued %',
    'market_heat': 'Market Heat Index',
    'price_cut_pct': 'Price Cut %',
    'new_listings': 'New Listings',
    'pending_listings': 'Pending Listings',
    'population': 'Population',
    'median_income': 'Median Income',
  };
  return titles[metricId] || metricId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
