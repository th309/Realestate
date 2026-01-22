/**
 * Metric Definitions
 *
 * Complete list of all 54 data card metrics matching the maps page sidebar.
 * Used by the health check service to monitor each metric.
 */

export interface MetricDefinition {
  metricId: string;
  metricName: string;
  category: string;
  tableName: string;
  columnName: string;
  source: string;
  freshnessThresholdDays: number;
  isNew?: boolean;
  isPro?: boolean;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // AFFORDABILITY - "Can I afford to live here?"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'listing_price', metricName: 'Listing Price', category: 'Affordability', tableName: 'realtor_zip', columnName: 'median_listing_price', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'income_to_buy', metricName: 'Income to Buy', category: 'Affordability', tableName: 'calculated_metrics', columnName: 'income_to_buy', source: 'Calculated', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'affordable_home_price', metricName: 'Affordable Home Price', category: 'Affordability', tableName: 'calculated_metrics', columnName: 'affordable_home_price', source: 'Calculated', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'price_per_sqft', metricName: 'Price Per Sq Ft', category: 'Affordability', tableName: 'realtor_zip', columnName: 'median_listing_price_per_sqft', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'years_to_save', metricName: 'Years to Save', category: 'Affordability', tableName: 'calculated_metrics', columnName: 'years_to_save', source: 'Calculated', freshnessThresholdDays: 36, isNew: true, isPro: true },
  { metricId: 'home_value_yoy_aff', metricName: 'Home Value YoY', category: 'Affordability', tableName: 'zillow_zip', columnName: 'zhvi_yoy', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: '5_year_growth_aff', metricName: '5-Year Growth', category: 'Affordability', tableName: 'zillow_zip', columnName: 'zhvi_5yr_growth', source: 'Zillow', freshnessThresholdDays: 36, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // MARKET COMPETITION - "Should I act fast?"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'days_on_market', metricName: 'Days on Market', category: 'Market Competition', tableName: 'zillow_zip', columnName: 'median_days_to_pending', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'inventory', metricName: 'Inventory', category: 'Market Competition', tableName: 'zillow_zip', columnName: 'for_sale_inventory', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'inventory_yoy', metricName: 'Inventory YoY', category: 'Market Competition', tableName: 'zillow_zip', columnName: 'inventory_yoy', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'pending_ratio', metricName: 'Pending Ratio', category: 'Market Competition', tableName: 'zillow_zip', columnName: 'pct_listings_price_cut', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'new_listings_yoy', metricName: 'New Listings YoY', category: 'Market Competition', tableName: 'zillow_zip', columnName: 'new_listings_yoy', source: 'Zillow', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'hotness_score', metricName: 'Hotness Score', category: 'Market Competition', tableName: 'realtor_zip', columnName: 'hotness_score', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'market_heat_index', metricName: 'Market Heat Index', category: 'Market Competition', tableName: 'calculated_metrics', columnName: 'market_heat_index', source: 'Calculated', freshnessThresholdDays: 36 },
  { metricId: 'sale_to_list_ratio', metricName: 'Sale-to-List Ratio', category: 'Market Competition', tableName: 'zillow_zip', columnName: 'mean_sale_to_list', source: 'Zillow', freshnessThresholdDays: 36, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // PRICING & DEALS - "Are prices going up or down?"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'home_value_yoy_price', metricName: 'Home Value YoY', category: 'Pricing & Deals', tableName: 'zillow_zip', columnName: 'zhvi_yoy', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'home_value_mom', metricName: 'Home Value MoM', category: 'Pricing & Deals', tableName: 'zillow_zip', columnName: 'zhvi_mom', source: 'Zillow', freshnessThresholdDays: 36, isPro: true },
  { metricId: 'home_price_forecast_price', metricName: 'Home Price Forecast', category: 'Pricing & Deals', tableName: 'propertyiq_scores', columnName: 'price_forecast', source: 'PropertyIQ', freshnessThresholdDays: 8, isPro: true },
  { metricId: 'price_cut_pct', metricName: 'Price Cut %', category: 'Pricing & Deals', tableName: 'realtor_zip', columnName: 'price_reduced_count_pct', source: 'Realtor', freshnessThresholdDays: 36 },
  { metricId: 'price_increase_pct', metricName: 'Price Increase %', category: 'Pricing & Deals', tableName: 'realtor_zip', columnName: 'price_increased_count_pct', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'new_listings', metricName: 'New Listings', category: 'Pricing & Deals', tableName: 'zillow_zip', columnName: 'new_listings', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'inventory_surplus_deficit', metricName: 'Inventory Surplus/Deficit', category: 'Pricing & Deals', tableName: 'calculated_metrics', columnName: 'inventory_surplus', source: 'Calculated', freshnessThresholdDays: 36, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // AREA PROFILE - "Who lives here?"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'population', metricName: 'Population', category: 'Area Profile', tableName: 'census_zip', columnName: 'population', source: 'Census', freshnessThresholdDays: 438 },
  { metricId: 'population_growth', metricName: 'Population Growth', category: 'Area Profile', tableName: 'census_zip', columnName: 'population_growth_yoy', source: 'Census', freshnessThresholdDays: 438, isPro: true },
  { metricId: 'median_income', metricName: 'Median Income', category: 'Area Profile', tableName: 'census_zip', columnName: 'median_household_income', source: 'Census', freshnessThresholdDays: 438 },
  { metricId: 'income_growth', metricName: 'Income Growth', category: 'Area Profile', tableName: 'census_zip', columnName: 'income_growth_yoy', source: 'Census', freshnessThresholdDays: 438, isPro: true },
  { metricId: 'median_age', metricName: 'Median Age', category: 'Area Profile', tableName: 'census_zip', columnName: 'median_age', source: 'Census', freshnessThresholdDays: 438, isPro: true },
  { metricId: 'homeownership_rate', metricName: 'Homeownership Rate', category: 'Area Profile', tableName: 'census_zip', columnName: 'homeownership_rate', source: 'Census', freshnessThresholdDays: 438, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // LOCAL ECONOMY - "How strong is the job market?"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'unemployment_rate', metricName: 'Unemployment Rate', category: 'Local Economy', tableName: 'economic_county', columnName: 'unemployment_rate', source: 'BLS', freshnessThresholdDays: 36 },
  { metricId: 'job_growth', metricName: 'Job Growth', category: 'Local Economy', tableName: 'economic_county', columnName: 'employment_growth_yoy', source: 'BLS', freshnessThresholdDays: 36, isPro: true },
  { metricId: 'gdp_growth', metricName: 'GDP Growth', category: 'Local Economy', tableName: 'economic_metro', columnName: 'gdp_growth', source: 'BEA', freshnessThresholdDays: 108, isPro: true },
  { metricId: 'cost_of_living', metricName: 'Cost of Living', category: 'Local Economy', tableName: 'economic_metro', columnName: 'rpp', source: 'BEA', freshnessThresholdDays: 438, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // NEW CONSTRUCTION - "What new homes are being built?"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'sf_permits', metricName: 'SF Permits', category: 'New Construction', tableName: 'permits_county', columnName: 'sf_units', source: 'Census', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'mf_permits', metricName: 'MF Permits', category: 'New Construction', tableName: 'permits_county', columnName: 'mf_units', source: 'Census', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'total_permits', metricName: 'Total Permits', category: 'New Construction', tableName: 'permits_county', columnName: 'total_units', source: 'Census', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'permits_yoy', metricName: 'Permits YoY', category: 'New Construction', tableName: 'permits_county', columnName: 'permits_yoy', source: 'Census', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'sf_mf_ratio', metricName: 'SF/MF Ratio', category: 'New Construction', tableName: 'permits_county', columnName: 'sf_mf_ratio', source: 'Census', freshnessThresholdDays: 36, isNew: true, isPro: true },
  { metricId: 'permit_value_unit', metricName: 'Permit Value/Unit', category: 'New Construction', tableName: 'permits_county', columnName: 'value_per_unit', source: 'Census', freshnessThresholdDays: 36, isNew: true, isPro: true },
  { metricId: 'new_construction_sales', metricName: 'New Construction Sales', category: 'New Construction', tableName: 'census_county', columnName: 'new_home_sales', source: 'Census', freshnessThresholdDays: 108 },
  { metricId: 'new_construction_price', metricName: 'New Construction Price', category: 'New Construction', tableName: 'census_county', columnName: 'new_home_median_price', source: 'Census', freshnessThresholdDays: 108 },
  { metricId: 'new_construction_share', metricName: 'New Construction $Share', category: 'New Construction', tableName: 'calculated_metrics', columnName: 'new_construction_share', source: 'Calculated', freshnessThresholdDays: 108, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // PROPERTYIQ SCORES - "AI-powered market analysis"
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'homeready_score', metricName: 'HomeReady Score', category: 'PropertyIQ Scores', tableName: 'propertyiq_scores', columnName: 'homeready_score', source: 'PropertyIQ', freshnessThresholdDays: 8, isNew: true, isPro: true },
  { metricId: 'investoredge_score', metricName: 'InvestorEdge Score', category: 'PropertyIQ Scores', tableName: 'propertyiq_scores', columnName: 'investoredge_score', source: 'PropertyIQ', freshnessThresholdDays: 8, isNew: true, isPro: true },
  { metricId: 'home_price_forecast', metricName: 'Home Price Forecast', category: 'PropertyIQ Scores', tableName: 'propertyiq_scores', columnName: 'price_forecast', source: 'PropertyIQ', freshnessThresholdDays: 8, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // CASH FLOW - "Will this make money monthly?" (Investor Mode)
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'cap_rate', metricName: 'Cap Rate', category: 'Cash Flow', tableName: 'calculated_metrics', columnName: 'cap_rate', source: 'Calculated', freshnessThresholdDays: 36, isPro: true },
  { metricId: 'rent_index', metricName: 'Rent Index', category: 'Cash Flow', tableName: 'zillow_zip', columnName: 'zori', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'renter_demand_index', metricName: 'Renter Demand Index', category: 'Cash Flow', tableName: 'calculated_metrics', columnName: 'renter_demand_index', source: 'Calculated', freshnessThresholdDays: 36 },
  { metricId: 'listing_price_cf', metricName: 'Listing Price', category: 'Cash Flow', tableName: 'realtor_zip', columnName: 'median_listing_price', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'price_per_sqft_cf', metricName: 'Price Per Sq Ft', category: 'Cash Flow', tableName: 'realtor_zip', columnName: 'median_listing_price_per_sqft', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },

  // ═══════════════════════════════════════════════════════════════════════
  // APPRECIATION - "Will the value grow?" (Investor Mode)
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'home_value_yoy_app', metricName: 'Home Value YoY', category: 'Appreciation', tableName: 'zillow_zip', columnName: 'zhvi_yoy', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: '5_year_growth_app', metricName: '5-Year Growth', category: 'Appreciation', tableName: 'zillow_zip', columnName: 'zhvi_5yr_growth', source: 'Zillow', freshnessThresholdDays: 36, isPro: true },
  { metricId: 'home_price_forecast_app', metricName: 'Home Price Forecast', category: 'Appreciation', tableName: 'propertyiq_scores', columnName: 'price_forecast', source: 'PropertyIQ', freshnessThresholdDays: 8, isPro: true },
  { metricId: 'home_value', metricName: 'Home Value', category: 'Appreciation', tableName: 'zillow_zip', columnName: 'zhvi', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'overvalued_pct', metricName: 'Overvalued %', category: 'Appreciation', tableName: 'calculated_metrics', columnName: 'overvalued_pct', source: 'Calculated', freshnessThresholdDays: 36, isPro: true },

  // ═══════════════════════════════════════════════════════════════════════
  // DEMAND & RISK - "Can I rent/sell it?" (Investor Mode)
  // ═══════════════════════════════════════════════════════════════════════
  { metricId: 'days_on_market_dr', metricName: 'Days on Market', category: 'Demand & Risk', tableName: 'zillow_zip', columnName: 'median_days_to_pending', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'inventory_dr', metricName: 'Inventory', category: 'Demand & Risk', tableName: 'zillow_zip', columnName: 'for_sale_inventory', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'inventory_yoy_dr', metricName: 'Inventory YoY', category: 'Demand & Risk', tableName: 'zillow_zip', columnName: 'inventory_yoy', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'pending_ratio_dr', metricName: 'Pending Ratio', category: 'Demand & Risk', tableName: 'zillow_zip', columnName: 'pct_listings_price_cut', source: 'Zillow', freshnessThresholdDays: 36 },
  { metricId: 'new_listings_yoy_dr', metricName: 'New Listings YoY', category: 'Demand & Risk', tableName: 'zillow_zip', columnName: 'new_listings_yoy', source: 'Zillow', freshnessThresholdDays: 36, isNew: true },
  { metricId: 'hotness_score_dr', metricName: 'Hotness Score', category: 'Demand & Risk', tableName: 'realtor_zip', columnName: 'hotness_score', source: 'Realtor', freshnessThresholdDays: 36, isNew: true },
];

// Get unique table names for health checks
export function getUniqueTables(): string[] {
  return [...new Set(METRIC_DEFINITIONS.map((m) => m.tableName))];
}

// Get metrics by table
export function getMetricsByTable(tableName: string): MetricDefinition[] {
  return METRIC_DEFINITIONS.filter((m) => m.tableName === tableName);
}
