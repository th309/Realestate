/**
 * METRIC REGISTRY
 *
 * Single source of truth for ALL metric definitions.
 * Add a new metric here and it automatically works everywhere:
 * - Map display, Legend, Tooltips, Data fetching, Color scales
 * - Time series graphs, Trend calculations, Score cards
 */

import type { GeoLevel, MetricConfig, DataSource } from "./types";

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
  national: "/api/geography/national",
  state: "/api/geography/states",
  county: "/api/geography/counties",
  metro: "/api/geography/metros",
  city: "/api/geography/cities",
  zip: "/api/geography/zips",
};

// ============================================================================
// DATA DATES CONFIGURATION
// ============================================================================

/**
 * Central configuration for "as of" dates by data source.
 * Update these when new data is imported.
 */
export const DATA_DATES: Record<DataSource, string> = {
  zillow: "2025-11-30",
  realtor: "2025-12-01",
  redfin: "2025-12-01",
  census: "2024",
  calculated: "2025-12-01",
  fred: "2025-09-01",
  propertyiq: "2025-12-01",
  bls: "2025-12-01",
  irs: "2023",
  redfin_migration: "2025-12-01",
};

// ============================================================================
// DATA SOURCE → PAGE ANCHOR MAPPING
// ============================================================================

/**
 * Maps DataSource values to anchor IDs on the /data page.
 * Used by the /data page to link metrics back to their provider cards.
 */
export const DATA_SOURCE_ANCHORS: Record<DataSource, string> = {
  zillow: "zillow",
  realtor: "realtor-com",
  redfin: "redfin",
  census: "census",
  calculated: "propertyiq",
  fred: "fred",
  propertyiq: "propertyiq",
  bls: "bls",
  irs: "irs",
  redfin_migration: "redfin",
};

// ============================================================================
// METRO-ONLY METRICS
// ============================================================================

/**
 * Metrics that only have data at the METRO level
 */
export const METRO_ONLY_METRICS = new Set([
  "rent_for_houses",
  "income_to_rent",
  "homeowner_affordability",
  "renter_affordability",
  "new_construction_sales",
  "new_construction_price",
  "new_construction_ppsf",
  "sale_price",
  "sale_to_list",
  "days_to_close",
  "market_health",
  "market_heat",
  "overvalued_pct",
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
    id: "home_value",
    title: "Home Value",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  home_price_forecast: {
    id: "home_price_forecast",
    title: "Home Price Forecast",
    format: "percent",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/forecast/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "zip"],
    favorableDirection: "higher",
  },

  home_value_yoy: {
    id: "home_value_yoy",
    title: "Home Value YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-value-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  home_value_mom: {
    id: "home_value_mom",
    title: "Home Value MoM",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-value-mom/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  home_value_5yr: {
    id: "home_value_5yr",
    title: "5-Year Growth",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/home-value-5yr/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "cagr_5yr",
    favorableDirection: "higher",
  },

  home_value_3yr: {
    id: "home_value_3yr",
    title: "3-Year Growth",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/home-value-3yr/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "zhvi_3y_cagr",
    favorableDirection: "higher",
  },

  // ============================================================================
  // RENT
  // ============================================================================
  rent_yoy: {
    id: "rent_yoy",
    title: "Rent YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/rent-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "zori_yoy",
    favorableDirection: "higher",
  },

  rent_5yr: {
    id: "rent_5yr",
    title: "Rent 5-Year Growth",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/metrics/rent-5yr/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "zori_5y_cagr",
    favorableDirection: "higher",
  },

  rent_index: {
    id: "rent_index",
    title: "Rent Index",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/rent/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    favorableDirection: "higher",
  },

  rent_for_houses: {
    id: "rent_for_houses",
    title: "Renter Demand Index",
    format: "index",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/demand/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    favorableDirection: "higher",
  },

  // ============================================================================
  // MARKET ACTIVITY
  // ============================================================================
  for_sale_inventory: {
    id: "for_sale_inventory",
    title: "Inventory",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/inventory/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "lower",
  },

  inventory_yoy: {
    id: "inventory_yoy",
    title: "Inventory YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/inventory-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "lower",
  },

  new_listings: {
    id: "new_listings",
    title: "New Listings",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/new-listings/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  pending_listings: {
    id: "pending_listings",
    title: "Pending Listings",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/pending-listings/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  home_sales: {
    id: "home_sales",
    title: "Home Sales",
    format: "number",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-sales/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  home_sales_yoy: {
    id: "home_sales_yoy",
    title: "Home Sales YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/home-sales-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  pending_ratio: {
    id: "pending_ratio",
    title: "Pending Ratio",
    format: "percent_abs",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/pending-ratio/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  days_on_market: {
    id: "days_on_market",
    title: "Days on Market",
    format: "days",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/dom/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "lower",
  },

  // ============================================================================
  // MARKET HEAT & HEALTH
  // ============================================================================
  market_heat: {
    id: "market_heat",
    title: "Market Heat Index",
    format: "index",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/market-heat/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    rangeType: "full",
    favorableDirection: "higher",
  },

  price_cut_pct: {
    id: "price_cut_pct",
    title: "Price Cut %",
    format: "percent_abs",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/price-reduced/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "lower",
  },

  sale_to_list: {
    id: "sale_to_list",
    title: "Sale-to-List Ratio",
    format: "percent_abs",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/sale-to-list/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    asPercent: true,
    favorableDirection: "higher",
  },

  // ============================================================================
  // AFFORDABILITY
  // ============================================================================
  homeowner_affordability: {
    id: "homeowner_affordability",
    title: "Homeowner Affordability %",
    format: "percent_abs",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/affordability/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "homeowner_affordability_percent",
    favorableDirection: "higher",
  },

  renter_affordability: {
    id: "renter_affordability",
    title: "Renter Affordability %",
    format: "percent_abs",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/affordability/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "renter_affordability_percent",
    favorableDirection: "higher",
  },

  years_to_save: {
    id: "years_to_save",
    title: "Years to Save",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/years-to-save/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "years_to_save",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  income_to_buy: {
    id: "income_to_buy",
    title: "Income to Buy",
    format: "currency",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/income-to-buy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "income_to_buy",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  income_to_rent: {
    id: "income_to_rent",
    title: "Income to Rent",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/affordability/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "renter_income_needed",
    favorableDirection: "lower",
  },

  affordable_home_price: {
    id: "affordable_home_price",
    title: "Affordable Home Price",
    format: "currency",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/affordable-home-price/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "affordable_home_price",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  // ============================================================================
  // LISTING PRICE
  // ============================================================================
  listing_price: {
    id: "listing_price",
    title: "Listing Price",
    format: "currency",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/listing-price/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  price_per_sqft: {
    id: "price_per_sqft",
    title: "Price Per Sq Ft",
    format: "currency",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/price-per-sqft/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    favorableDirection: "higher",
  },

  price_increase_pct: {
    id: "price_increase_pct",
    title: "Price Increase %",
    format: "percent_abs",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/price-increased/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  new_listings_yoy: {
    id: "new_listings_yoy",
    title: "New Listings YoY",
    format: "percent",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/new-listings-yoy/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    asPercent: true,
    favorableDirection: "higher",
  },

  // ============================================================================
  // MARKET HEAT SCORES (Realtor Hotness)
  // ============================================================================
  hotness_score: {
    id: "hotness_score",
    title: "Hotness Score",
    format: "index",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/hotness/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    rangeType: "full",
    favorableDirection: "higher",
  },

  supply_score: {
    id: "supply_score",
    title: "Supply Score",
    format: "index",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/supply-score/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    rangeType: "full",
    favorableDirection: "lower",
  },

  demand_score: {
    id: "demand_score",
    title: "Demand Score",
    format: "index",
    dataSource: "realtor",
    apiEndpoint: "/api/realtor/demand-score/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    rangeType: "full",
    favorableDirection: "higher",
  },

  // ============================================================================
  // INVESTOR METRICS
  // ============================================================================
  cap_rate: {
    id: "cap_rate",
    title: "Cap Rate",
    format: "percent_abs",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/cap-rate/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "cap_rate",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  gross_yield: {
    id: "gross_yield",
    title: "Gross Yield",
    format: "percent_abs",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/gross-yield/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "gross_yield",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  grm: {
    id: "grm",
    title: "Gross Rent Multiplier",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/grm/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "grm",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  rent_to_price_ratio: {
    id: "rent_to_price_ratio",
    title: "Rent-to-Price Ratio",
    format: "percent_abs",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/rent-to-price/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "rent_to_price_ratio",
    asPercent: true,
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  investment_score: {
    id: "investment_score",
    title: "Investment Score",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/investment-score/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "investment_score",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  long_term_growth_score: {
    id: "long_term_growth_score",
    title: "Long-Term Growth Score",
    format: "number",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/long-term-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "long_term_growth_score",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  overvalued_pct: {
    id: "overvalued_pct",
    title: "Overvalued %",
    format: "percent",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/overvalued/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "overvalued_pct",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  inventory_surplus: {
    id: "inventory_surplus",
    title: "Inventory Surplus/Deficit",
    format: "percent",
    dataSource: "calculated",
    apiEndpoint: "/api/metrics/inventory-surplus/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "zip"],
    valueField: "inventory_surplus",
    hasTimeSeries: true,
    favorableDirection: "lower",
  },

  // ============================================================================
  // NEW CONSTRUCTION
  // ============================================================================
  new_construction_sales: {
    id: "new_construction_sales",
    title: "New Construction Sales",
    format: "number",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/new-construction/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "sales_count",
    favorableDirection: "higher",
  },

  new_construction_price: {
    id: "new_construction_price",
    title: "New Construction Price",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/new-construction/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "median_sale_price",
    favorableDirection: "higher",
  },

  new_construction_ppsf: {
    id: "new_construction_ppsf",
    title: "New Construction $/SqFt",
    format: "currency",
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/new-construction/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    valueField: "price_per_sqft",
    favorableDirection: "higher",
  },

  // ============================================================================
  // BUILDING PERMITS (Census Bureau BPS)
  // ============================================================================
  sf_permits: {
    id: "sf_permits",
    title: "SF Permits",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "sf_units",
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ["county"],
    favorableDirection: "higher",
  },

  mf_permits: {
    id: "mf_permits",
    title: "MF Permits",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "large_multi_units",
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ["county"],
    favorableDirection: "higher",
  },

  total_permits: {
    id: "total_permits",
    title: "Total Permits",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "total_units",
    scaleMin: 0,
    scaleMax: 200,
    scaleForGeos: ["county"],
    favorableDirection: "higher",
  },

  permits_yoy: {
    id: "permits_yoy",
    title: "Permits YoY",
    format: "percent",
    dataSource: "census",
    apiEndpoint: "/api/permits/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "total_units_yoy",
    favorableDirection: "higher",
  },

  sf_mf_ratio: {
    id: "sf_mf_ratio",
    title: "SF/MF Ratio",
    format: "percent_abs",
    dataSource: "census",
    apiEndpoint: "/api/permits/sf-ratio/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "sf_ratio",
    includeNullValues: true,
    favorableDirection: "neutral",
  },

  permit_value_per_unit: {
    id: "permit_value_per_unit",
    title: "Permit Value/Unit",
    format: "currency",
    dataSource: "census",
    apiEndpoint: "/api/permits/value-per-unit/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "county"],
    valueField: "value_per_unit",
    favorableDirection: "higher",
  },

  // ============================================================================
  // AREA PROFILE (Census)
  // ============================================================================
  population: {
    id: "population",
    title: "Population",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/census/population/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  population_growth: {
    id: "population_growth",
    title: "Population Growth",
    format: "percent",
    dataSource: "census",
    apiEndpoint: "/api/census/population-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  median_income: {
    id: "median_income",
    title: "Median Income",
    format: "currency",
    dataSource: "census",
    apiEndpoint: "/api/census/median-income/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  income_growth: {
    id: "income_growth",
    title: "Income Growth",
    format: "percent",
    dataSource: "census",
    apiEndpoint: "/api/census/income-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  median_age: {
    id: "median_age",
    title: "Median Age",
    format: "number",
    dataSource: "census",
    apiEndpoint: "/api/census/median-age/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "neutral",
  },

  homeownership_rate: {
    id: "homeownership_rate",
    title: "Homeownership Rate",
    format: "percent_abs",
    dataSource: "census",
    apiEndpoint: "/api/census/homeownership-rate/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county", "city", "zip"],
    favorableDirection: "higher",
  },

  // ============================================================================
  // LOCAL ECONOMY (FRED/BEA)
  // ============================================================================
  unemployment_rate: {
    id: "unemployment_rate",
    title: "Unemployment Rate",
    format: "percent_abs",
    dataSource: "fred",
    apiEndpoint: "/api/economic/unemployment/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county"],
    favorableDirection: "lower",
  },

  job_growth: {
    id: "job_growth",
    title: "Job Growth",
    format: "percent",
    dataSource: "fred",
    apiEndpoint: "/api/economic/job-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county"],
    favorableDirection: "higher",
  },

  gdp_growth: {
    id: "gdp_growth",
    title: "GDP Growth",
    format: "percent",
    dataSource: "fred",
    apiEndpoint: "/api/economic/gdp-growth/{geo}",
    keyField: "auto",
    supportedGeos: ["national", "state", "metro", "county"],
    favorableDirection: "higher",
  },

  cost_of_living: {
    id: "cost_of_living",
    title: "Cost of Living",
    format: "index_1dec",
    dataSource: "fred",
    apiEndpoint: "/api/economic/cost-of-living/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro"],
    rangeType: "full",
    favorableDirection: "lower",
  },

  // ============================================================================
  // PROPERTYIQ SCORES
  // ============================================================================
  propertyiq_score: {
    id: "propertyiq_score",
    title: "PropertyIQ Score",
    format: "index",
    dataSource: "propertyiq",
    apiEndpoint: "/api/scores/{geo}/{location_id}",
    keyField: "auto",
    supportedGeos: ["metro", "county", "zip"],
    valueField: "propertyiq_score",
    rangeType: "full",
    hasTimeSeries: true,
    favorableDirection: "higher",
  },

  // ============================================================================
  // EMPLOYMENT BY SECTOR (BLS)
  // ============================================================================
  employment_natural_resources_mining: {
    id: "employment_natural_resources_mining",
    title: "Natural Resources & Mining Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_natural_resources_mining/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_construction: {
    id: "employment_construction",
    title: "Construction Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_construction/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_manufacturing: {
    id: "employment_manufacturing",
    title: "Manufacturing Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_manufacturing/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_trade_transport_utilities: {
    id: "employment_trade_transport_utilities",
    title: "Trade, Transportation & Utilities Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_trade_transport_utilities/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_information: {
    id: "employment_information",
    title: "Information Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_information/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_financial_activities: {
    id: "employment_financial_activities",
    title: "Financial Activities Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_financial_activities/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_professional_business_services: {
    id: "employment_professional_business_services",
    title: "Professional & Business Services Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_professional_business_services/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_education_health_services: {
    id: "employment_education_health_services",
    title: "Education & Health Services Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_education_health_services/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_leisure_hospitality: {
    id: "employment_leisure_hospitality",
    title: "Leisure & Hospitality Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_leisure_hospitality/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_other_services: {
    id: "employment_other_services",
    title: "Other Services Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_other_services/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  employment_public_administration: {
    id: "employment_public_administration",
    title: "Public Administration Employment",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/employment_public_administration/{geo}",
    keyField: "auto",
    supportedGeos: ["state", "metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  // ============================================================================
  // QCEW (BLS Quarterly Census of Employment & Wages)
  // ============================================================================
  qcew_avg_weekly_wage: {
    id: "qcew_avg_weekly_wage",
    title: "Average Weekly Wage",
    format: "currency",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/qcew_avg_weekly_wage/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  qcew_total_establishments: {
    id: "qcew_total_establishments",
    title: "Total Establishments",
    format: "number",
    dataSource: "bls",
    apiEndpoint: "/api/metrics/qcew_total_establishments/{geo}",
    keyField: "auto",
    supportedGeos: ["metro", "county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  // ============================================================================
  // IRS COUNTY-TO-COUNTY MIGRATION
  // ============================================================================
  irs_migration_in_returns: {
    id: "irs_migration_in_returns",
    title: "IRS Migration In (Returns)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_in_returns/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_out_returns: {
    id: "irs_migration_out_returns",
    title: "IRS Migration Out (Returns)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_out_returns/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "lower",
  },

  irs_migration_net_returns: {
    id: "irs_migration_net_returns",
    title: "IRS Net Migration (Returns)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_net_returns/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_in_avg_agi: {
    id: "irs_migration_in_avg_agi",
    title: "IRS Inbound Migration Avg AGI",
    format: "currency",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_in_avg_agi/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_out_avg_agi: {
    id: "irs_migration_out_avg_agi",
    title: "IRS Outbound Migration Avg AGI",
    format: "currency",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_out_avg_agi/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "neutral",
  },

  irs_migration_in_exemptions: {
    id: "irs_migration_in_exemptions",
    title: "IRS Migration In (Exemptions)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_in_exemptions/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  irs_migration_out_exemptions: {
    id: "irs_migration_out_exemptions",
    title: "IRS Migration Out (Exemptions)",
    format: "number",
    dataSource: "irs",
    apiEndpoint: "/api/metrics/irs_migration_out_exemptions/{geo}",
    keyField: "auto",
    supportedGeos: ["county"],
    rangeType: "dynamic",
    favorableDirection: "lower",
  },

  // ============================================================================
  // REDFIN MIGRATION
  // ============================================================================
  redfin_migration_net_inflow: {
    id: "redfin_migration_net_inflow",
    title: "Redfin Net Inflow",
    format: "number",
    dataSource: "redfin_migration",
    apiEndpoint: "/api/metrics/redfin_migration_net_inflow/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    rangeType: "dynamic",
    favorableDirection: "higher",
  },

  redfin_migration_inflow_share: {
    id: "redfin_migration_inflow_share",
    title: "Redfin Inflow Share",
    format: "percent",
    dataSource: "redfin_migration",
    apiEndpoint: "/api/metrics/redfin_migration_inflow_share/{geo}",
    keyField: "auto",
    supportedGeos: ["metro"],
    rangeType: "full",
    favorableDirection: "higher",
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
    case "zillow":
    case "realtor":
    case "redfin":
    case "census":
    case "fred":
    case "calculated":
      return true;
    case "propertyiq":
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
  return metricId === "propertyiq_score";
}
