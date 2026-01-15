/**
 * CENTRAL METRIC CONFIGURATION
 *
 * Single source of truth for ALL metric definitions.
 * Add a new metric here and it automatically works everywhere:
 * - Map display
 * - Legend
 * - Tooltips with "as of" date
 * - Data fetching
 * - Color scale
 */

import type { GeoLevel } from '../types';

// Display format types
export type MetricFormat = 'currency' | 'percent' | 'percent_abs' | 'number' | 'index' | 'days';

// Data source types
export type DataSource = 'zillow' | 'realtor' | 'calculated' | 'census' | 'fred';

// Metric configuration interface
export interface MetricConfig {
  id: string;
  title: string;
  format: MetricFormat;
  dataSource: DataSource;

  // API endpoint pattern - {geo} will be replaced with 'states', 'metros', etc.
  apiEndpoint: string;

  // Which field to use as the key when mapping response data
  // 'auto' = automatically choose based on geo level
  keyField: 'auto' | 'region_id' | 'region_name' | 'cbsa_code' | 'county_fips' | 'postal_code';

  // Which geographies support this metric
  supportedGeos: GeoLevel[];

  // If true, multiply value by 100 (for decimal percentages like 0.05 -> 5%)
  asPercent?: boolean;

  // Optional: field name in response if different from 'value'
  valueField?: string;

  // Range calculation: 'dynamic' uses actual data range, 'full' uses 0-100% of data
  rangeType?: 'dynamic' | 'full';
}

/**
 * ALL METRIC DEFINITIONS
 *
 * To add a new metric:
 * 1. Add it to this object
 * 2. Ensure the backend has the endpoint
 * 3. That's it - everything else is automatic
 */
export const METRICS: Record<string, MetricConfig> = {
  // ============================================================================
  // HOME VALUES
  // ============================================================================
  home_value: {
    id: 'home_value',
    title: 'Home Value',
    format: 'currency',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'city', 'zip'],
  },

  home_price_forecast: {
    id: 'home_price_forecast',
    title: 'Home Price Forecast',
    format: 'percent',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/forecast/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'zip'],
  },

  home_value_yoy: {
    id: 'home_value_yoy',
    title: 'Home Value YoY',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/home-value-yoy/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  home_value_mom: {
    id: 'home_value_mom',
    title: 'Home Value MoM',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/home-value-mom/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  home_value_5yr: {
    id: 'home_value_5yr',
    title: '5-Year Growth (CAGR)',
    format: 'percent',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/home-value-5yr/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro'],
    valueField: 'cagr_5yr',
  },

  // ============================================================================
  // RENT
  // ============================================================================
  rent_index: {
    id: 'rent_index',
    title: 'Rent Index',
    format: 'currency',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/rent/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
  },

  rent_for_houses: {
    id: 'rent_for_houses',
    title: 'Renter Demand Index',
    format: 'index',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/demand/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'zip'],
  },

  // ============================================================================
  // MARKET ACTIVITY
  // ============================================================================
  for_sale_inventory: {
    id: 'for_sale_inventory',
    title: 'Inventory',
    format: 'number',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/inventory/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
  },

  inventory_yoy: {
    id: 'inventory_yoy',
    title: 'Inventory YoY',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/inventory-yoy/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  new_listings: {
    id: 'new_listings',
    title: 'New Listings',
    format: 'number',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/new-listings/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
  },

  pending_listings: {
    id: 'pending_listings',
    title: 'Pending Listings',
    format: 'number',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/pending-listings/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
  },

  days_on_market: {
    id: 'days_on_market',
    title: 'Days on Market',
    format: 'days',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/dom/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
  },

  // ============================================================================
  // MARKET HEAT & HEALTH
  // ============================================================================
  market_heat: {
    id: 'market_heat',
    title: 'Market Heat Index',
    format: 'index',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/market-heat/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    rangeType: 'full', // Use full data range (no percentile clipping)
  },

  price_cut_pct: {
    id: 'price_cut_pct',
    title: 'Price Cut %',
    format: 'percent_abs',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/price-reduced/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro', 'county', 'zip'],
  },

  sale_to_list: {
    id: 'sale_to_list',
    title: 'Sale-to-List Ratio',
    format: 'percent_abs',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/sale-to-list/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
  },

  // ============================================================================
  // AFFORDABILITY
  // ============================================================================
  homeowner_affordability: {
    id: 'homeowner_affordability',
    title: 'Homeowner Affordability %',
    format: 'percent_abs',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/affordability/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'homeowner_affordability_percent',
  },

  renter_affordability: {
    id: 'renter_affordability',
    title: 'Renter Affordability %',
    format: 'percent_abs',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/affordability/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'renter_affordability_percent',
  },

  years_to_save: {
    id: 'years_to_save',
    title: 'Years to Save',
    format: 'number',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/affordability/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'years_to_save',
  },

  // ============================================================================
  // INVESTOR METRICS
  // ============================================================================
  cap_rate: {
    id: 'cap_rate',
    title: 'Cap Rate',
    format: 'percent_abs',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/cap-rate/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'cap_rate',
  },

  overvalued_pct: {
    id: 'overvalued_pct',
    title: 'Overvalued %',
    format: 'percent',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/overvalued/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'overvalued_pct',
  },
};

/**
 * Get metric configuration by ID
 */
export function getMetricConfig(metricId: string): MetricConfig | undefined {
  return METRICS[metricId];
}

/**
 * Get the key field for a given geography level
 */
export function getKeyFieldForGeo(geoLevel: GeoLevel): string {
  switch (geoLevel) {
    case 'state':
    case 'national':
      return 'region_name';
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'county_fips';
    case 'zip':
      return 'postal_code';
    case 'city':
      return 'region_name';
    default:
      return 'region_id';
  }
}

/**
 * Get the geo path segment for API URLs
 */
export function getGeoPathSegment(geoLevel: GeoLevel): string {
  switch (geoLevel) {
    case 'state':
    case 'national':
      return 'states';
    case 'metro':
      return 'metros';
    case 'county':
      return 'counties';
    case 'zip':
      return 'zips';
    case 'city':
      return 'cities';
    default:
      return 'metros';
  }
}

/**
 * Check if a metric supports a given geography level
 */
export function isMetricSupportedForGeo(metricId: string, geoLevel: GeoLevel): boolean {
  const config = METRICS[metricId];
  if (!config) return false;

  // National level uses state data
  if (geoLevel === 'national') {
    return config.supportedGeos.includes('state');
  }

  return config.supportedGeos.includes(geoLevel);
}

/**
 * Get metric format
 */
export function getMetricFormat(metricId: string): MetricFormat {
  return METRICS[metricId]?.format || 'currency';
}

/**
 * Get metric title
 */
export function getMetricTitle(metricId: string, forecastHorizon?: string): string {
  const config = METRICS[metricId];
  if (!config) {
    return metricId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Special case for forecast - include horizon in title
  if (metricId === 'home_price_forecast' && forecastHorizon) {
    return forecastHorizon === '1m' ? '1-Month Forecast'
      : forecastHorizon === '3m' ? '3-Month Forecast'
      : '12-Month Forecast';
  }

  return config.title;
}
