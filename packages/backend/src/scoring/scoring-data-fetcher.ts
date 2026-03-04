/**
 * Scoring Data Fetcher (v3.0)
 *
 * Assembles LocationMetrics by querying multiple data sources:
 * - Redfin (market activity: DOM, sold above list, sale-to-list, etc.)
 * - Census (population, age, income, homeownership, rent burden)
 * - Economic (GDP YoY)
 * - Zillow (inventory, metro only via crosswalk)
 * - Realtor (price_reduced_share, pending_listing_count_yy)
 * - Calculated metrics (income_to_buy)
 * - FRED macro (VIX — national scalar, same for all locations)
 *
 * Used by ScoringService.calculateAllScores() to build the full dataset
 * before z-score and formula calculations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { LocationMetrics } from './scoring.types';
import {
  PAGE_SIZE,
  getRedfinTable,
  getRedfinIdColumn,
  getRedfinNameColumn,
  getCensusIdColumn,
  getLatestCensusYear,
  getLatestEconomicDate,
  toEndOfMonth,
} from './scoring-data-helpers';
import {
  fetchZillowInventory,
  fetchRealtorData,
  fetchCalculatedMetrics,
  fetchFredMacro,
} from './scoring-supplementary-fetchers';

// Re-export helpers used by scoring.service.ts and validation scripts
export {
  getRedfinTable,
  getRedfinIdColumn,
  getRedfinNameColumn,
  getZillowTable,
} from './scoring-data-helpers';

/**
 * Get the latest Redfin period_end for a geography level.
 */
export async function getLatestRedfinDate(
  supabase: SupabaseClient,
  geography: GeographyLevel,
): Promise<string | null> {
  const table = getRedfinTable(geography);
  const { data } = await supabase
    .from(table)
    .select('period_end')
    .order('period_end', { ascending: false })
    .limit(1);

  return data?.[0]?.period_end || null;
}

/**
 * Fetch all metrics for all locations at a geography level.
 * Orchestrates Redfin + Census + Economic + Zillow + Realtor + Calculated + FRED.
 */
export async function fetchAllMetrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<LocationMetrics[]> {
  const locationsMap = new Map<string, LocationMetrics>();

  // Redfin: primary anchor — builds the location set
  await fetchRedfinData(supabase, locationsMap, geography, periodDate);
  if (locationsMap.size === 0) return [];

  // Supplementary data sources
  await fetchCensusData(supabase, locationsMap, geography, periodDate);
  await fetchEconomicData(supabase, locationsMap, geography, periodDate);
  await fetchZillowInventory(supabase, locationsMap, geography, periodDate);
  await fetchRealtorData(supabase, locationsMap, geography, periodDate);
  await fetchCalculatedMetrics(supabase, locationsMap, geography, periodDate);
  await fetchFredMacro(supabase, locationsMap, periodDate);

  return Array.from(locationsMap.values());
}

// ============================================================================
// Redfin
// ============================================================================

async function fetchRedfinData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const table = getRedfinTable(geography);
  const idCol = getRedfinIdColumn(geography);
  const nameCol = getRedfinNameColumn(geography);

  const selectCols = [
    idCol,
    nameCol,
    'median_dom',
    'off_market_in_two_weeks',
    'sold_above_list',
    'avg_sale_to_list',
    'homes_sold_yoy',
    'sold_above_list_yoy',
    'avg_sale_to_list_yoy',
    'median_dom_yoy',
    'median_sale_price',
  ].join(', ');

  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    // Redfin uses end-of-month dates (e.g., 2025-12-31), convert if needed
    const redfinDate = toEndOfMonth(periodDate);
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq('property_type', 'All Residential')
      .eq('period_end', redfinDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Redfin fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      const locationId = r[idCol];
      locationsMap.set(locationId, {
        location_id: locationId,
        location_name: r[nameCol] || locationId,
        median_price: r.median_sale_price,
        rf_median_dom: r.median_dom,
        rf_off_market_in_two_weeks: r.off_market_in_two_weeks,
        rf_sold_above_list: r.sold_above_list,
        rf_avg_sale_to_list: r.avg_sale_to_list,
        rf_homes_sold_yoy: r.homes_sold_yoy,
        rf_sold_above_list_yoy: r.sold_above_list_yoy,
        rf_avg_sale_to_list_yoy: r.avg_sale_to_list_yoy,
        rf_median_dom_yoy: r.median_dom_yoy,
      });
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
}

// ============================================================================
// Census
// ============================================================================

async function fetchCensusData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const tableMap: Record<GeographyLevel, string> = {
    metro: 'census_metro',
    county: 'census_county',
    zip: 'census_zip',
  };
  const table = tableMap[geography];
  const idCol = getCensusIdColumn(geography);

  const targetYear = new Date(periodDate).getFullYear();
  const censusYear = await getLatestCensusYear(supabase, table, targetYear);
  if (!censusYear) return;

  const selectCols =
    `${idCol}, population_yoy, homeownership_rate, median_age, income_yoy, rent_as_pct_of_income` +
    (geography === 'zip' ? ', median_home_value' : '');

  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq('year', censusYear)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Census fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      const location = locationsMap.get(r[idCol]);
      if (location) {
        if (r.median_age != null) location.cen_median_age = r.median_age;
        if (r.population_yoy != null)
          location.cen_population_yoy = r.population_yoy;
        if (r.income_yoy != null) location.cen_income_yoy = r.income_yoy;
        if (r.homeownership_rate != null)
          location.cen_homeownership_rate = r.homeownership_rate;
        if (r.rent_as_pct_of_income != null)
          location.cen_rent_as_pct_of_income = r.rent_as_pct_of_income;
        if (
          geography === 'zip' &&
          location.median_price == null &&
          r.median_home_value != null
        ) {
          location.median_price = r.median_home_value;
        }
      }
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
}

// ============================================================================
// Economic
// ============================================================================

async function fetchEconomicData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const tableMap: Record<GeographyLevel, string> = {
    metro: 'economic_metro',
    county: 'economic_county',
    zip: 'economic_county',
  };
  const idColMap: Record<GeographyLevel, string> = {
    metro: 'cbsa_code',
    county: 'fips_code',
    zip: 'fips_code',
  };
  const table = tableMap[geography];
  const idCol = idColMap[geography];

  // GDP not in ZIP formulas; skip
  if (geography === 'zip') return;

  const econDate = await getLatestEconomicDate(supabase, table, periodDate);
  if (!econDate) return;

  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, gdp_yoy`)
      .eq('period_date', econDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Economic fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      const location = locationsMap.get(r[idCol]);
      if (location && r.gdp_yoy != null) {
        location.econ_gdp_yoy = r.gdp_yoy;
      }
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
}
