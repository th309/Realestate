/**
 * Metric ID → Database Mapping
 *
 * Maps frontend metric IDs to their database source, column name, and filter config.
 * This is a pure static lookup with no runtime dependencies.
 *
 * Extracted from TimeSeriesService to keep the service under the 300-line limit.
 */

export interface MetricMapping {
  source: string;
  columnName: string;
  usesMetricName: boolean;
  metricNameValue?: string;
}

/**
 * Static mapping of every frontend metric ID to its database location.
 *
 * - Realtor tables: Direct column names (e.g., median_listing_price)
 * - Zillow tables: metric_name filter + value column
 * - Census: Direct column names, uses 'year' not 'period_date'
 * - Economic: Direct column names
 * - Calculated: Stored in calculated_metrics table
 * - Computed: On-the-fly calculation (investment, overvalued, permits)
 * - PropertyIQ: Score history from propertyiq_scores table
 */
const METRIC_MAPPINGS: Record<string, MetricMapping> = {
  // ========================================================================
  // REALTOR METRICS (Direct Column Names)
  // ========================================================================
  listing_price: {
    source: 'realtor',
    columnName: 'median_listing_price',
    usesMetricName: false,
  },
  home_value_yoy: {
    source: 'realtor',
    columnName: 'median_listing_price_yy',
    usesMetricName: false,
  },
  home_value_mom: {
    source: 'realtor',
    columnName: 'median_listing_price_mm',
    usesMetricName: false,
  },
  for_sale_inventory: {
    source: 'realtor',
    columnName: 'active_listing_count',
    usesMetricName: false,
  },
  inventory_yoy: {
    source: 'realtor',
    columnName: 'active_listing_count_yy',
    usesMetricName: false,
  },
  days_on_market: {
    source: 'realtor',
    columnName: 'median_days_on_market',
    usesMetricName: false,
  },
  new_listings: {
    source: 'realtor',
    columnName: 'new_listing_count',
    usesMetricName: false,
  },
  pending_listings: {
    source: 'realtor',
    columnName: 'pending_listing_count',
    usesMetricName: false,
  },
  price_cut_pct: {
    source: 'realtor',
    columnName: 'price_reduced_share',
    usesMetricName: false,
  },
  price_per_sqft: {
    source: 'realtor',
    columnName: 'median_listing_price_per_square_foot',
    usesMetricName: false,
  },
  pending_ratio: {
    source: 'realtor',
    columnName: 'pending_ratio',
    usesMetricName: false,
  },
  hotness_score: {
    source: 'realtor',
    columnName: 'hotness_score',
    usesMetricName: false,
  },
  supply_score: {
    source: 'realtor',
    columnName: 'supply_score',
    usesMetricName: false,
  },
  demand_score: {
    source: 'realtor',
    columnName: 'demand_score',
    usesMetricName: false,
  },
  price_increase_pct: {
    source: 'realtor',
    columnName: 'price_increased_share',
    usesMetricName: false,
  },
  new_listings_yoy: {
    source: 'realtor',
    columnName: 'new_listing_count_yy',
    usesMetricName: false,
  },

  // ========================================================================
  // ZILLOW METRICS (Uses metric_name + value column)
  // ========================================================================
  home_value: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'zhvi',
  },
  home_price_forecast: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'zhvf_12m',
  },
  rent_index: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'zori',
  },
  rent_for_houses: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'zordi_sfr',
  },
  sale_price: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'sale_price',
  },
  sale_to_list: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'sale_to_list',
  },
  home_sales: {
    source: 'realtor',
    columnName: 'pending_listing_count',
    usesMetricName: false,
  },
  home_sales_yoy: {
    source: 'realtor',
    columnName: 'pending_listing_count_yy',
    usesMetricName: false,
  },
  market_heat: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'market_heat_index',
  },
  new_construction_sales: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'new_con_sales',
  },
  new_construction_price: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'new_con_median_price',
  },
  new_construction_ppsf: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'new_con_median_price_per_sqft',
  },

  // ========================================================================
  // CENSUS/DEMOGRAPHIC METRICS (Direct Column Names, uses 'year' not 'period_date')
  // ========================================================================
  population: {
    source: 'census',
    columnName: 'total_population',
    usesMetricName: false,
  },
  population_growth: {
    source: 'census',
    columnName: 'population_yoy',
    usesMetricName: false,
  },
  median_income: {
    source: 'census',
    columnName: 'median_household_income',
    usesMetricName: false,
  },
  income_growth: {
    source: 'census',
    columnName: 'income_yoy',
    usesMetricName: false,
  },
  median_age: {
    source: 'census',
    columnName: 'median_age',
    usesMetricName: false,
  },
  homeownership_rate: {
    source: 'census',
    columnName: 'homeownership_rate',
    usesMetricName: false,
  },

  // ========================================================================
  // ECONOMIC METRICS (Direct Column Names)
  // ========================================================================
  unemployment_rate: {
    source: 'economic',
    columnName: 'unemployment_rate',
    usesMetricName: false,
  },
  job_growth: {
    source: 'economic',
    columnName: 'employment_yoy',
    usesMetricName: false,
  },
  gdp_growth: {
    source: 'economic',
    columnName: 'gdp_yoy',
    usesMetricName: false,
  },
  cost_of_living: {
    source: 'economic',
    columnName: 'rpp_all_items',
    usesMetricName: false,
  },

  // ========================================================================
  // CALCULATED METRICS (Direct or Computed)
  // ========================================================================
  cap_rate: {
    source: 'computed_investment',
    columnName: 'cap_rate',
    usesMetricName: false,
  },
  income_to_buy: {
    source: 'calculated',
    columnName: 'income_to_buy',
    usesMetricName: false,
  },
  years_to_save: {
    source: 'calculated',
    columnName: 'years_to_save',
    usesMetricName: false,
  },
  affordable_home_price: {
    source: 'calculated',
    columnName: 'affordable_home_price',
    usesMetricName: false,
  },
  gross_yield: {
    source: 'computed_investment',
    columnName: 'gross_yield',
    usesMetricName: false,
  },
  grm: {
    source: 'computed_investment',
    columnName: 'grm',
    usesMetricName: false,
  },
  rent_to_price_ratio: {
    source: 'computed_investment',
    columnName: 'rent_to_price_ratio',
    usesMetricName: false,
  },
  investment_score: {
    source: 'calculated',
    columnName: 'investment_score',
    usesMetricName: false,
  },
  long_term_growth_score: {
    source: 'calculated',
    columnName: 'long_term_growth_score',
    usesMetricName: false,
  },
  overvalued_pct: {
    source: 'computed_overvalued',
    columnName: 'overvalued_pct',
    usesMetricName: false,
  },
  inventory_surplus: {
    source: 'calculated',
    columnName: 'inventory_surplus_pct',
    usesMetricName: false,
  },
  home_value_5yr: {
    source: 'calculated',
    columnName: 'cagr_5yr',
    usesMetricName: false,
  },
  home_value_3yr: {
    source: 'calculated',
    columnName: 'zhvi_3y_cagr',
    usesMetricName: false,
  },
  rent_yoy: {
    source: 'calculated',
    columnName: 'zori_yoy',
    usesMetricName: false,
  },
  rent_5yr: {
    source: 'calculated',
    columnName: 'zori_5y_cagr',
    usesMetricName: false,
  },

  // ========================================================================
  // AFFORDABILITY METRICS (Zillow metro-only)
  // ========================================================================
  homeowner_affordability: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'new_homeowner_affordability',
  },
  renter_affordability: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'new_renter_affordability',
  },
  income_to_rent: {
    source: 'zillow',
    columnName: 'value',
    usesMetricName: true,
    metricNameValue: 'renter_income',
  },

  // ========================================================================
  // BUILDING PERMITS (Census Bureau BPS)
  // ========================================================================
  sf_permits: {
    source: 'permits',
    columnName: 'sf_units',
    usesMetricName: false,
  },
  mf_permits: {
    source: 'permits',
    columnName: 'large_multi_units',
    usesMetricName: false,
  },
  total_permits: {
    source: 'permits',
    columnName: 'total_units',
    usesMetricName: false,
  },
  permits_yoy: {
    source: 'computed_permits',
    columnName: 'permits_yoy',
    usesMetricName: false,
  },
  sf_mf_ratio: {
    source: 'computed_permits',
    columnName: 'sf_mf_ratio',
    usesMetricName: false,
  },
  permit_value_per_unit: {
    source: 'computed_permits',
    columnName: 'permit_value_per_unit',
    usesMetricName: false,
  },

  // ========================================================================
  // PROPERTYIQ SCORES (from propertyiq_scores table)
  // ========================================================================
  homeready_score: {
    source: 'propertyiq',
    columnName: 'score',
    usesMetricName: true,
    metricNameValue: 'homeready',
  },
  investoredge_score: {
    source: 'propertyiq',
    columnName: 'score',
    usesMetricName: true,
    metricNameValue: 'investoredge',
  },
  market_health_score: {
    source: 'propertyiq',
    columnName: 'score',
    usesMetricName: true,
    metricNameValue: 'markethealth',
  },
};

/**
 * Look up the database mapping for a frontend metric ID.
 * Returns null if the metric ID is not recognized.
 */
export function getMetricMapping(metricId: string): MetricMapping | null {
  return METRIC_MAPPINGS[metricId] || null;
}
