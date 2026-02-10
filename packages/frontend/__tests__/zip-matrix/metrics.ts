/**
 * ZIP Matrix Test - Metrics Configuration
 *
 * All 40 metrics from the maps sidebar with their API endpoint mappings.
 */

import type { MetricConfig } from './types';

/**
 * Metrics that have ZIP-level data
 */
export const ZIP_METRICS: MetricConfig[] = [
  // ============================================================================
  // AFFORDABILITY
  // ============================================================================
  {
    id: 'listing_price',
    name: 'Listing Price',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'median_listing_price',
    zipLevel: true,
  },
  {
    id: 'income_to_buy',
    name: 'Income to Buy',
    endpoint: '/api/metrics/snapshot/income_to_buy',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'affordable_home_price',
    name: 'Affordable Home Price',
    endpoint: '/api/metrics/snapshot/affordable_home_price',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },
  {
    id: 'price_per_sqft',
    name: 'Price Per Sqft',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'median_ppsf',
    zipLevel: true,
  },
  {
    id: 'years_to_save',
    name: 'Years to Save',
    endpoint: '/api/metrics/snapshot/years_to_save',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },
  {
    id: 'home_value_yoy',
    name: 'Home Value YoY',
    endpoint: '/api/metrics/timeseries/home_value',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'home_value_5yr',
    name: 'Home Value 5yr',
    endpoint: '/api/metrics/timeseries/home_value',
    endpointType: 'individual',
    zipLevel: true,
  },

  // ============================================================================
  // COMPETITION
  // ============================================================================
  {
    id: 'days_on_market',
    name: 'Days on Market',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'median_dom',
    zipLevel: true,
  },
  {
    id: 'for_sale_inventory',
    name: 'For Sale Inventory',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'active_listing_count',
    zipLevel: true,
  },
  {
    id: 'inventory_yoy',
    name: 'Inventory YoY',
    endpoint: '/api/metrics/snapshot/inventory_yoy',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'pending_ratio',
    name: 'Pending Ratio',
    endpoint: '/api/metrics/snapshot/pending_ratio',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'new_listings_yoy',
    name: 'New Listings YoY',
    endpoint: '/api/metrics/snapshot/new_listings_yoy',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'hotness_score',
    name: 'Hotness Score',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'hotness_score',
    zipLevel: true,
  },
  {
    id: 'sale_to_list',
    name: 'Sale to List',
    endpoint: '/api/zillow/sale-to-list/zips',
    endpointType: 'state-list',
    zipLevel: true,
  },

  // ============================================================================
  // PRICING
  // ============================================================================
  {
    id: 'home_value_mom',
    name: 'Home Value MoM',
    endpoint: '/api/metrics/timeseries/home_value',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'price_cut_pct',
    name: 'Price Cut %',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'price_reduced_count',
    zipLevel: true,
  },
  {
    id: 'price_increase_pct',
    name: 'Price Increase %',
    endpoint: '/api/metrics/snapshot/price_increase_pct',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'new_listings',
    name: 'New Listings',
    endpoint: '/api/realtor/zips',
    endpointType: 'state-list',
    valueField: 'new_listing_count',
    zipLevel: true,
  },
  {
    id: 'inventory_surplus',
    name: 'Inventory Surplus',
    endpoint: '/api/metrics/snapshot/inventory_surplus',
    endpointType: 'individual',
    zipLevel: true,
  },

  // ============================================================================
  // CASH FLOW
  // ============================================================================
  {
    id: 'cap_rate',
    name: 'Cap Rate',
    endpoint: '/api/metrics/snapshot/cap_rate',
    endpointType: 'individual',
    zipLevel: true,
  },
  {
    id: 'rent_index',
    name: 'Rent Index',
    endpoint: '/api/zillow/rent/zips',
    endpointType: 'state-list',
    zipLevel: true,
  },
  {
    id: 'rent_for_houses',
    name: 'Rent for Houses',
    endpoint: '/api/zillow/rent/zips',
    endpointType: 'state-list',
    params: { propertyType: 'sfr' },
    zipLevel: true,
  },

  // ============================================================================
  // APPRECIATION
  // ============================================================================
  {
    id: 'home_value',
    name: 'Home Value',
    endpoint: '/api/zillow/zips',
    endpointType: 'state-list',
    zipLevel: true,
  },
  {
    id: 'overvalued_pct',
    name: 'Overvalued %',
    endpoint: '/api/metrics/snapshot/overvalued_pct',
    endpointType: 'individual',
    zipLevel: true,
  },

  // ============================================================================
  // AREA PROFILE (Census)
  // ============================================================================
  {
    id: 'population',
    name: 'Population',
    endpoint: '/api/census/zips',
    endpointType: 'state-list',
    valueField: 'population',
    zipLevel: true,
  },
  {
    id: 'population_growth',
    name: 'Population Growth',
    endpoint: '/api/census/zips',
    endpointType: 'state-list',
    valueField: 'population_growth',
    zipLevel: true,
  },
  {
    id: 'median_income',
    name: 'Median Income',
    endpoint: '/api/census/zips',
    endpointType: 'state-list',
    valueField: 'median_income',
    zipLevel: true,
  },
  {
    id: 'income_growth',
    name: 'Income Growth',
    endpoint: '/api/census/zips',
    endpointType: 'state-list',
    valueField: 'income_growth',
    zipLevel: true,
  },
  {
    id: 'median_age',
    name: 'Median Age',
    endpoint: '/api/census/zips',
    endpointType: 'state-list',
    valueField: 'median_age',
    zipLevel: true,
  },
  {
    id: 'homeownership_rate',
    name: 'Homeownership Rate',
    endpoint: '/api/census/zips',
    endpointType: 'state-list',
    valueField: 'homeownership_rate',
    zipLevel: true,
  },

  // ============================================================================
  // LOCAL ECONOMY
  // ============================================================================
  {
    id: 'unemployment_rate',
    name: 'Unemployment Rate',
    endpoint: '/api/economic/zips',
    endpointType: 'state-list',
    valueField: 'unemployment_rate',
    zipLevel: true,
  },
  {
    id: 'job_growth',
    name: 'Job Growth',
    endpoint: '/api/economic/metros',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },
  {
    id: 'gdp_growth',
    name: 'GDP Growth',
    endpoint: '/api/economic/metros',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },
  {
    id: 'cost_of_living',
    name: 'Cost of Living',
    endpoint: '/api/economic/metros',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },

  // ============================================================================
  // NEW CONSTRUCTION
  // ============================================================================
  {
    id: 'sf_permits',
    name: 'SF Permits',
    endpoint: '/api/permits/zips',
    endpointType: 'state-list',
    valueField: 'sf_permits',
    zipLevel: true,
  },
  {
    id: 'mf_permits',
    name: 'MF Permits',
    endpoint: '/api/permits/zips',
    endpointType: 'state-list',
    valueField: 'mf_permits',
    zipLevel: true,
  },
  {
    id: 'total_permits',
    name: 'Total Permits',
    endpoint: '/api/permits/zips',
    endpointType: 'state-list',
    valueField: 'total_permits',
    zipLevel: true,
  },
  {
    id: 'permits_yoy',
    name: 'Permits YoY',
    endpoint: '/api/permits/zips',
    endpointType: 'state-list',
    valueField: 'permits_yoy',
    zipLevel: true,
  },
  {
    id: 'sf_mf_ratio',
    name: 'SF/MF Ratio',
    endpoint: '/api/permits/zips',
    endpointType: 'state-list',
    valueField: 'sf_mf_ratio',
    zipLevel: true,
  },
  {
    id: 'permit_value_per_unit',
    name: 'Permit Value Per Unit',
    endpoint: '/api/permits/zips',
    endpointType: 'state-list',
    valueField: 'value_per_unit',
    zipLevel: true,
  },
  {
    id: 'new_construction_sales',
    name: 'New Construction Sales',
    endpoint: '/api/zillow/new-construction/metros',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },
  {
    id: 'new_construction_price',
    name: 'New Construction Price',
    endpoint: '/api/zillow/new-construction/metros',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },
  {
    id: 'new_construction_ppsf',
    name: 'New Construction PPSF',
    endpoint: '/api/zillow/new-construction/metros',
    endpointType: 'individual',
    zipLevel: false, // Metro only
  },

  // ============================================================================
  // PROPERTYIQ SCORES
  // ============================================================================
  {
    id: 'homeready_score',
    name: 'HomeReady Score',
    endpoint: '/api/scores',
    endpointType: 'individual',
    params: { type: 'homeready' },
    zipLevel: true,
  },
  {
    id: 'investoredge_score',
    name: 'InvestorEdge Score',
    endpoint: '/api/scores',
    endpointType: 'individual',
    params: { type: 'investoredge' },
    zipLevel: true,
  },
  {
    id: 'market_health_score',
    name: 'Market Health Score',
    endpoint: '/api/scores',
    endpointType: 'individual',
    params: { type: 'markethealth' },
    zipLevel: true,
  },
];

/**
 * Critical metrics - tests fail if these are missing
 * Only includes metrics with confirmed ZIP-level data availability
 */
export const CRITICAL_METRICS = [
  'home_value', // Confirmed: /api/zillow/zips returns data
];

/**
 * Metro-only metrics - marked as n/a for ZIP tests
 */
export const METRO_ONLY_METRICS = ZIP_METRICS
  .filter(m => !m.zipLevel)
  .map(m => m.id);

/**
 * Get metric config by ID
 */
export function getMetric(id: string): MetricConfig | undefined {
  return ZIP_METRICS.find(m => m.id === id);
}

/**
 * US States list
 */
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];
