/**
 * METRIC ALIAS CONSTANTS
 *
 * Maps metric IDs between template names and actual data field names.
 * The backend stores data under Zillow-style names (zhvi, zori, zordi)
 * while templates and UI code may reference descriptive names
 * (home_value, median_rent, rental_demand_index).
 *
 * Also contains geography hierarchy and label constants used by
 * both value-access and geo-fallback helpers.
 */

import type { GeoLevel } from "@/lib/data";

/**
 * Map of common metric ID aliases between template and actual data.
 * Each key maps to an ordered list of alternative IDs to try.
 */
export const METRIC_ALIASES: Record<string, string[]> = {
  zhvi: ["home_value", "median_listing_price"],
  home_value: ["zhvi", "median_listing_price"],
  median_listing_price: ["zhvi", "home_value"],
  median_household_income: ["median_income"],
  median_income: ["median_household_income"],
  net_migration: ["migration_net"],
  population_growth_yoy: ["population_growth", "population_yoy"],
  population_yoy: ["population_growth_yoy", "population_growth"],
  unemployment_rate: ["unemployment"],
  job_growth_yoy: ["job_growth"],
  income_growth_yoy: ["income_growth"],
  // YoY aliases
  home_value_yoy: ["zhvi_yoy", "median_listing_price_yoy"],
  zhvi_yoy: ["home_value_yoy", "median_listing_price_yoy"],
  // Appreciation / growth aliases (descriptive <-> Zillow names)
  home_value_3y_cagr: ["zhvi_3y_cagr", "appreciation_3yr"],
  zhvi_3y_cagr: ["home_value_3y_cagr", "appreciation_3yr"],
  home_value_5y_cagr: ["zhvi_5y_cagr", "appreciation_5yr"],
  zhvi_5y_cagr: ["home_value_5y_cagr", "appreciation_5yr"],
  home_value_forecast_1yr: ["zhvf_1yr_pct", "forecast_1yr"],
  zhvf_1yr_pct: ["home_value_forecast_1yr", "forecast_1yr"],
  // Rent aliases (descriptive <-> Zillow names)
  median_rent: ["zori", "rent_index", "median_gross_rent"],
  zori: ["median_rent", "rent_index", "median_gross_rent"],
  rent_yoy: ["zori_yoy", "rent_growth_yoy"],
  zori_yoy: ["rent_yoy", "rent_growth_yoy"],
  rent_5y_cagr: ["zori_5y_cagr", "rent_growth_5yr"],
  zori_5y_cagr: ["rent_5y_cagr", "rent_growth_5yr"],
  rental_demand_index: ["zordi", "renter_demand_index"],
  zordi: ["rental_demand_index", "renter_demand_index"],
  // Listing/inventory aliases
  for_sale_inventory: ["active_listing_count"],
  active_listing_count: ["for_sale_inventory"],
  median_days_on_market: ["days_on_market"],
  days_on_market: ["median_days_on_market"],
  price_cut_pct: ["price_reduced_share"],
  price_reduced_share: ["price_cut_pct"],
  hotness_score: ["market_hotness"],
};

/**
 * Geography hierarchy for fallback lookups (most specific to most general)
 */
export const GEO_HIERARCHY: GeoLevel[] = [
  "zip",
  "city",
  "county",
  "metro",
  "state",
  "national",
];

/**
 * Geography level display names
 */
export const GEO_LABELS: Record<GeoLevel, string> = {
  zip: "ZIP code",
  city: "City",
  county: "County",
  metro: "Metro area",
  state: "State",
  national: "National",
  tract: "Census tract",
};
