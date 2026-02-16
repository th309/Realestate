/**
 * METRIC REGISTRY
 *
 * Single source of truth for ALL metric definitions.
 * Add a new metric here and it automatically works everywhere:
 * - Map display, Legend, Tooltips, Data fetching, Color scales
 * - Time series graphs, Trend calculations, Score cards
 */

import type { GeoLevel, MetricConfig, DataSource } from './types';

// ============================================================================
// MAP DISPLAY SETTINGS
// ============================================================================

/**
 * Default zoom levels by geography type
 */
export const GEO_ZOOM_LEVELS: Record<GeoLevel, number> = {
  national: 4,
  state: 4,
  metro: 4,
  county: 4,
  city: 4,
  zip: 4,
  tract: 6,
};

/**
 * GeoJSON source endpoints for each geography level
 */
export const GEOJSON_SOURCES: Record<string, string> = {
  national: '/api/geography/national',
  state: '/api/geography/states',
  county: '/api/geography/counties',
  metro: '/api/geography/metros',
  city: '/api/geography/cities',
  zip: '/api/geography/zips',
};

// ============================================================================
// DATA DATES CONFIGURATION
// ============================================================================

/**
 * Central configuration for "as of" dates by data source.
 * Update these when new data is imported.
 */
export const DATA_DATES: Record<DataSource, string> = {
  zillow: '2025-11-30',
  realtor: '2025-12-01',
  census: '2024',
  calculated: '2025-12-01',
  fred: '2025-09-01',
  propertyiq: '2025-12-01',
};

// ============================================================================
// DATA SOURCE → PAGE ANCHOR MAPPING
// ============================================================================

/**
 * Maps DataSource values to anchor IDs on the /data page.
 * Used by the /data page to link metrics back to their provider cards.
 */
export const DATA_SOURCE_ANCHORS: Record<DataSource, string> = {
  zillow: 'zillow',
  realtor: 'realtor-com',
  census: 'census',
  calculated: 'propertyiq',
  fred: 'fred',
  propertyiq: 'propertyiq',
};

// ============================================================================
// METRO-ONLY METRICS
// ============================================================================

/**
 * Metrics that only have data at the METRO level
 */
export const METRO_ONLY_METRICS = new Set([
  'rent_for_houses',
  'income_to_rent',
  'homeowner_affordability',
  'renter_affordability',
  'new_construction_sales',
  'new_construction_price',
  'new_construction_ppsf',
  'sale_price',
  'sale_to_list',
  'days_to_close',
  'market_health',
  'market_heat',
  'overvalued_pct',
]);

// ============================================================================
// METRIC DEFINITIONS
// ============================================================================

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
    title: '5-Year Growth',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/metrics/home-value-5yr/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
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
    supportedGeos: ['metro'],
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
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  inventory_yoy: {
    id: 'inventory_yoy',
    title: 'Inventory YoY',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/inventory-yoy/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  new_listings: {
    id: 'new_listings',
    title: 'New Listings',
    format: 'number',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/new-listings/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  pending_listings: {
    id: 'pending_listings',
    title: 'Pending Listings',
    format: 'number',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/pending-listings/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  home_sales: {
    id: 'home_sales',
    title: 'Home Sales',
    format: 'number',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/home-sales/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  home_sales_yoy: {
    id: 'home_sales_yoy',
    title: 'Home Sales YoY',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/home-sales-yoy/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  pending_ratio: {
    id: 'pending_ratio',
    title: 'Pending Ratio',
    format: 'percent_abs',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/pending-ratio/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  days_on_market: {
    id: 'days_on_market',
    title: 'Days on Market',
    format: 'days',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/dom/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
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
    rangeType: 'full',
  },

  price_cut_pct: {
    id: 'price_cut_pct',
    title: 'Price Cut %',
    format: 'percent_abs',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/price-reduced/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  sale_to_list: {
    id: 'sale_to_list',
    title: 'Sale-to-List Ratio',
    format: 'percent_abs',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/sale-to-list/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    asPercent: true,
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
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/years-to-save/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    valueField: 'years_to_save',
    hasTimeSeries: true,
  },

  income_to_buy: {
    id: 'income_to_buy',
    title: 'Income to Buy',
    format: 'currency',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/income-to-buy/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    valueField: 'income_to_buy',
    hasTimeSeries: true,
  },

  income_to_rent: {
    id: 'income_to_rent',
    title: 'Income to Rent',
    format: 'currency',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/affordability/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'renter_income',
  },

  affordable_home_price: {
    id: 'affordable_home_price',
    title: 'Affordable Home Price',
    format: 'currency',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/affordable-home-price/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    valueField: 'affordable_home_price',
    hasTimeSeries: true,
  },

  // ============================================================================
  // LISTING PRICE
  // ============================================================================
  listing_price: {
    id: 'listing_price',
    title: 'Listing Price',
    format: 'currency',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/listing-price/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  price_per_sqft: {
    id: 'price_per_sqft',
    title: 'Price Per Sq Ft',
    format: 'currency',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/price-per-sqft/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
  },

  price_increase_pct: {
    id: 'price_increase_pct',
    title: 'Price Increase %',
    format: 'percent_abs',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/price-increased/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  new_listings_yoy: {
    id: 'new_listings_yoy',
    title: 'New Listings YoY',
    format: 'percent',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/new-listings-yoy/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    asPercent: true,
  },

  // ============================================================================
  // MARKET HEAT SCORES (Realtor Hotness)
  // ============================================================================
  hotness_score: {
    id: 'hotness_score',
    title: 'Hotness Score',
    format: 'index',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/hotness/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    rangeType: 'full',
  },

  supply_score: {
    id: 'supply_score',
    title: 'Supply Score',
    format: 'index',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/supply-score/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    rangeType: 'full',
  },

  demand_score: {
    id: 'demand_score',
    title: 'Demand Score',
    format: 'index',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/demand-score/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    rangeType: 'full',
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
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'cap_rate',
    hasTimeSeries: true,
  },

  gross_yield: {
    id: 'gross_yield',
    title: 'Gross Yield',
    format: 'percent_abs',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/gross-yield/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'gross_yield',
    hasTimeSeries: true,
  },

  grm: {
    id: 'grm',
    title: 'Gross Rent Multiplier',
    format: 'number',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/grm/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'grm',
    hasTimeSeries: true,
  },

  rent_to_price_ratio: {
    id: 'rent_to_price_ratio',
    title: 'Rent-to-Price Ratio',
    format: 'percent',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/rent-to-price/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'rent_to_price_ratio',
    hasTimeSeries: true,
  },

  investment_score: {
    id: 'investment_score',
    title: 'Investment Score',
    format: 'number',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/investment-score/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'investment_score',
    hasTimeSeries: true,
  },

  long_term_growth_score: {
    id: 'long_term_growth_score',
    title: 'Long-Term Growth Score',
    format: 'number',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/long-term-growth/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'long_term_growth_score',
    hasTimeSeries: true,
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
    hasTimeSeries: true,
  },

  inventory_surplus: {
    id: 'inventory_surplus',
    title: 'Inventory Surplus/Deficit',
    format: 'percent',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/inventory-surplus/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    valueField: 'inventory_surplus',
    hasTimeSeries: true,
  },

  // ============================================================================
  // NEW CONSTRUCTION
  // ============================================================================
  new_construction_sales: {
    id: 'new_construction_sales',
    title: 'New Construction Sales',
    format: 'number',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/new-construction/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'sales_count',
  },

  new_construction_price: {
    id: 'new_construction_price',
    title: 'New Construction Price',
    format: 'currency',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/new-construction/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'median_sale_price',
  },

  new_construction_ppsf: {
    id: 'new_construction_ppsf',
    title: 'New Construction $/SqFt',
    format: 'currency',
    dataSource: 'zillow',
    apiEndpoint: '/api/zillow/new-construction/{geo}',
    keyField: 'auto',
    supportedGeos: ['metro'],
    valueField: 'price_per_sqft',
  },

  // ============================================================================
  // BUILDING PERMITS (Census Bureau BPS)
  // ============================================================================
  sf_permits: {
    id: 'sf_permits',
    title: 'SF Permits',
    format: 'number',
    dataSource: 'census',
    apiEndpoint: '/api/permits/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'county'],
    valueField: 'sf_units',
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ['county'],
  },

  mf_permits: {
    id: 'mf_permits',
    title: 'MF Permits',
    format: 'number',
    dataSource: 'census',
    apiEndpoint: '/api/permits/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'county'],
    valueField: 'large_multi_units',
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ['county'],
  },

  total_permits: {
    id: 'total_permits',
    title: 'Total Permits',
    format: 'number',
    dataSource: 'census',
    apiEndpoint: '/api/permits/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'county'],
    valueField: 'total_units',
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ['county'],
  },

  permits_yoy: {
    id: 'permits_yoy',
    title: 'Permits YoY',
    format: 'percent',
    dataSource: 'census',
    apiEndpoint: '/api/permits/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'county'],
    valueField: 'total_units_yoy',
  },

  sf_mf_ratio: {
    id: 'sf_mf_ratio',
    title: 'SF/MF Ratio',
    format: 'percent_abs',
    dataSource: 'census',
    apiEndpoint: '/api/permits/sf-ratio/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'county'],
    valueField: 'sf_ratio',
    includeNullValues: true,
  },

  permit_value_per_unit: {
    id: 'permit_value_per_unit',
    title: 'Permit Value/Unit',
    format: 'currency',
    dataSource: 'census',
    apiEndpoint: '/api/permits/value-per-unit/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'county'],
    valueField: 'value_per_unit',
  },

  // ============================================================================
  // AREA PROFILE (Census)
  // ============================================================================
  population: {
    id: 'population',
    title: 'Population',
    format: 'number',
    dataSource: 'census',
    apiEndpoint: '/api/census/population/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'city', 'zip'],
  },

  population_growth: {
    id: 'population_growth',
    title: 'Population Growth',
    format: 'percent',
    dataSource: 'census',
    apiEndpoint: '/api/census/population-growth/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'city', 'zip'],
  },

  median_income: {
    id: 'median_income',
    title: 'Median Income',
    format: 'currency',
    dataSource: 'census',
    apiEndpoint: '/api/census/median-income/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'city', 'zip'],
  },

  income_growth: {
    id: 'income_growth',
    title: 'Income Growth',
    format: 'percent',
    dataSource: 'census',
    apiEndpoint: '/api/census/income-growth/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'city', 'zip'],
  },

  median_age: {
    id: 'median_age',
    title: 'Median Age',
    format: 'number',
    dataSource: 'census',
    apiEndpoint: '/api/census/median-age/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'city', 'zip'],
  },

  homeownership_rate: {
    id: 'homeownership_rate',
    title: 'Homeownership Rate',
    format: 'percent_abs',
    dataSource: 'census',
    apiEndpoint: '/api/census/homeownership-rate/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'city', 'zip'],
  },

  // ============================================================================
  // LOCAL ECONOMY (FRED/BEA)
  // ============================================================================
  unemployment_rate: {
    id: 'unemployment_rate',
    title: 'Unemployment Rate',
    format: 'percent_abs',
    dataSource: 'fred',
    apiEndpoint: '/api/economic/unemployment/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county'],
  },

  job_growth: {
    id: 'job_growth',
    title: 'Job Growth',
    format: 'percent',
    dataSource: 'fred',
    apiEndpoint: '/api/economic/job-growth/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county'],
  },

  gdp_growth: {
    id: 'gdp_growth',
    title: 'GDP Growth',
    format: 'percent',
    dataSource: 'fred',
    apiEndpoint: '/api/economic/gdp-growth/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county'],
  },

  cost_of_living: {
    id: 'cost_of_living',
    title: 'Cost of Living',
    format: 'index_1dec',
    dataSource: 'fred',
    apiEndpoint: '/api/economic/cost-of-living/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro'],
    rangeType: 'full',
  },

  // ============================================================================
  // PROPERTYIQ SCORES
  // ============================================================================
  homeready_score: {
    id: 'homeready_score',
    title: 'HomeReady Score',
    format: 'number',
    dataSource: 'propertyiq',
    apiEndpoint: '/api/scores/{geo}/{location_id}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'homeready_score',
    rangeType: 'full',
    hasTimeSeries: true,
  },

  investoredge_score: {
    id: 'investoredge_score',
    title: 'InvestorEdge Score',
    format: 'number',
    dataSource: 'propertyiq',
    apiEndpoint: '/api/scores/{geo}/{location_id}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'investoredge_score',
    rangeType: 'full',
    hasTimeSeries: true,
  },

  market_health_score: {
    id: 'market_health_score',
    title: 'Market Health Score',
    format: 'number',
    dataSource: 'propertyiq',
    apiEndpoint: '/api/scores/{geo}/{location_id}',
    keyField: 'auto',
    supportedGeos: ['metro', 'county', 'zip'],
    valueField: 'market_health_score',
    rangeType: 'full',
    hasTimeSeries: true,
  },
};

/**
 * Check if a metric has time series data available.
 * Defaults true for zillow/realtor/census/fred/calculated, false for propertyiq (scores).
 */
export function metricHasTimeSeries(metricId: string): boolean {
  const config = METRICS[metricId];
  if (!config) return false;

  // Explicit setting takes precedence
  if (config.hasTimeSeries !== undefined) {
    return config.hasTimeSeries;
  }

  // Default based on data source
  switch (config.dataSource) {
    case 'zillow':
    case 'realtor':
    case 'census':
    case 'fred':
    case 'calculated':
      return true;
    case 'propertyiq':
      return false;
    default:
      return false;
  }
}

/**
 * Check if a metric is a PropertyIQ score metric.
 * These require special handling (score API instead of time series).
 */
export function isScoreMetric(metricId: string): boolean {
  return ['homeready_score', 'investoredge_score', 'market_health_score'].includes(metricId);
}
