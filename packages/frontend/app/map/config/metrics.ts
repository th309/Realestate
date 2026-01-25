/**
 * CENTRAL METRIC CONFIGURATION
 *
 * Single source of truth for ALL metric definitions and map display settings.
 * Add a new metric here and it automatically works everywhere:
 * - Map display
 * - Legend
 * - Tooltips with "as of" date
 * - Data fetching
 * - Color scale
 */

// GeoLevel defined here to avoid circular imports (types.ts re-exports from here)
export type GeoLevel = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip' | 'tract';

// ============================================================================
// MAP DISPLAY SETTINGS
// ============================================================================

/**
 * Default zoom levels by geography type
 * Used when displaying data for each geography level
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
 * City and zip require state parameter: /api/geography/cities/:state
 */
export const GEOJSON_SOURCES: Record<string, string> = {
  national: '/api/geography/national',
  state: '/api/geography/states',
  county: '/api/geography/counties',
  metro: '/api/geography/metros',
  city: '/api/geography/cities',
  zip: '/api/geography/zips',
};

/**
 * Get the default zoom level for a geography type
 */
export function getDefaultZoom(geoLevel: GeoLevel): number {
  return GEO_ZOOM_LEVELS[geoLevel] ?? 4;
}

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
    asPercent: true, // Data stored as decimal (0.35 = 35%)
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
    rangeType: 'full', // Use full data range (no percentile clipping)
  },

  price_cut_pct: {
    id: 'price_cut_pct',
    title: 'Price Cut %',
    format: 'percent_abs',
    dataSource: 'realtor',
    apiEndpoint: '/api/realtor/price-reduced/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
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
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/years-to-save/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    valueField: 'years_to_save',
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
  },

  // ============================================================================
  // LISTING PRICE (Realtor median_listing_price - broader coverage than Zillow)
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

  inventory_surplus: {
    id: 'inventory_surplus',
    title: 'Inventory Surplus/Deficit',
    format: 'percent',
    dataSource: 'calculated',
    apiEndpoint: '/api/metrics/inventory-surplus/{geo}',
    keyField: 'auto',
    supportedGeos: ['national', 'state', 'metro', 'county', 'zip'],
    valueField: 'inventory_surplus',
  },

  // ============================================================================
  // NEW CONSTRUCTION (Zillow metro only)
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
  // BUILDING PERMITS (Census Bureau BPS - national/state/county)
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
    // QCEW provides employment data for all metros and counties
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
    format: 'index',
    dataSource: 'fred',
    apiEndpoint: '/api/economic/cost-of-living/{geo}',
    keyField: 'auto',
    supportedGeos: ['state', 'metro'],
    rangeType: 'full',
  },

  // ============================================================================
  // PROPERTYIQ SCORES (from propertyiq_scores table)
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
      return 'place_fips';
    default:
      return 'region_id';
  }
}

/**
 * Get the geo path segment for API URLs
 */
export function getGeoPathSegment(geoLevel: GeoLevel): string {
  switch (geoLevel) {
    case 'national':
      return 'national';
    case 'state':
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
 * Metrics that only have data at the METRO level
 * Used by both UI (to disable geo pills) and data fetching
 * Single source of truth for metro-only constraints
 *
 * NOTE: Many Realtor metrics now support national/state/metro/county/zip
 * Only Zillow-specific and calculated metrics remain metro-only
 */
export const METRO_ONLY_METRICS = new Set([
  // Zillow rent data (only available at metro/county/zip from ZORI)
  'rent_index',
  'rent_for_houses',         // Renter Demand Index (ZORDI)
  // Zillow affordability (only metro) - NOTE: income_to_buy, affordable_home_price, and years_to_save now support all geos via calculated metrics
  'income_to_rent',
  'homeowner_affordability',
  'renter_affordability',
  // Zillow new construction (only metro)
  'new_construction_sales',
  'new_construction_price',
  'new_construction_ppsf',
  // Zillow sales data (only metro)
  'sale_price',
  'sale_to_list',
  'days_to_close',
  // Zillow market heat (only metro)
  'market_health',
  'market_heat',
  // Calculated metrics (only metro for now)
  'overvalued_pct',
]);

/**
 * Check if a metric supports a given geography level
 */
export function isMetricSupportedForGeo(metricId: string, geoLevel: GeoLevel): boolean {
  const config = METRICS[metricId];
  if (!config) return false;

  // Check if metric is metro-only (override supportedGeos config)
  if (METRO_ONLY_METRICS.has(metricId)) {
    return geoLevel === 'metro';
  }

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

// ============================================================================
// DATA DATES CONFIGURATION
// ============================================================================

/**
 * Central configuration for "as of" dates by data source.
 * Update these when new data is imported to ensure consistent display
 * across all maps, metrics, and geographies.
 *
 * Format: 'YYYY-MM-DD' for monthly data, 'YYYY' for annual data
 */
export const DATA_DATES: Record<DataSource, string> = {
  zillow: '2025-11-30',      // Zillow ZHVI, forecasts, rent indices
  realtor: '2025-12-01',     // Realtor.com inventory and market metrics
  census: '2024',            // Census ACS data (annual)
  calculated: '2025-12-01',  // Derived metrics (income_to_buy uses Realtor data)
  fred: '2025-09-01',        // FRED economic indicators
};

/**
 * Get the "as of" date for a metric
 * Returns the date from the central config based on the metric's data source
 */
export function getMetricDataDate(metricId: string): string {
  const config = METRICS[metricId];
  if (!config) return DATA_DATES.zillow; // Default fallback

  return DATA_DATES[config.dataSource];
}

/**
 * Format data date for display in tooltips
 * Converts '2025-11-30' to 'Nov 2025' or '2024' to '2024'
 */
export function formatDataDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';

  // Handle annual data (just a year like '2024')
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  try {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${month} ${year}`;
  } catch {
    return dateStr;
  }
}
