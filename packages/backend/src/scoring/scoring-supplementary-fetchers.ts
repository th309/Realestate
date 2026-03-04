/** Supplementary data fetchers: Zillow inventory, Realtor, calculated metrics, FRED macro. */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { LocationMetrics } from './scoring.types';
import {
  PAGE_SIZE,
  getZillowTable,
  getZillowIdColumn,
  getLatestZillowDate,
} from './scoring-data-helpers';

// Zillow Inventory (metro uses crosswalk, county/zip direct)
// ============================================================================

/**
 * Fetch Zillow inventory data. Metro uses crosswalk to map region_id → cbsa_code.
 */
export async function fetchZillowInventory(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const table = getZillowTable(geography);
  const inventoryDate = await getLatestZillowDate(
    supabase,
    table,
    'inventory',
    periodDate,
  );
  if (!inventoryDate) return;

  if (geography === 'metro') {
    await fetchZillowMetroInventoryViaCrosswalk(
      supabase,
      locationsMap,
      inventoryDate,
    );
  } else {
    const idCol = getZillowIdColumn(geography);
    let page = 0;
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from(table)
        .select(`${idCol}, value`)
        .eq('metric_name', 'inventory')
        .eq('period_date', inventoryDate)
        .order(idCol, { ascending: true })
        .range(from, to);

      if (error || !data || data.length === 0) break;
      for (const row of data) {
        const r = row as Record<string, any>;
        const location = locationsMap.get(r[idCol]);
        if (location && r.value != null) location.z_inventory = r.value;
      }
      if (data.length < PAGE_SIZE) break;
      page += 1;
    }
  }
}

async function fetchZillowMetroInventoryViaCrosswalk(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  inventoryDate: string,
): Promise<void> {
  // Build region_id → cbsa_code crosswalk
  const regionIdToCbsa = new Map<string, string>();
  let crosswalkPage = 0;
  while (true) {
    const from = crosswalkPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, cbsa_code')
      .not('cbsa_code', 'is', null)
      .range(from, to);

    if (!data || data.length === 0) break;
    for (const row of data) {
      regionIdToCbsa.set(String(row.zillow_region_id), row.cbsa_code);
    }
    if (data.length < PAGE_SIZE) break;
    crosswalkPage += 1;
  }

  // Fetch inventory by region_id, map to cbsa_code
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('zillow_metro')
      .select('region_id, cbsa_code, value')
      .eq('metric_name', 'inventory')
      .eq('period_date', inventoryDate)
      .order('region_id', { ascending: true })
      .range(from, to);

    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const r = row as Record<string, any>;
      const cbsa = r.cbsa_code || regionIdToCbsa.get(String(r.region_id));
      if (!cbsa) continue;
      const location = locationsMap.get(cbsa);
      if (location && r.value != null) location.z_inventory = r.value;
    }
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
}

// Realtor Data (price_reduced_share, pending_listing_count_yy)
// ============================================================================

/** Realtor table per geography. */
function getRealtorTable(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'realtor_metro';
    case 'county':
      return 'realtor_county';
    case 'zip':
      return 'realtor_zip';
    default:
      return 'realtor_metro';
  }
}

/** Realtor ID column per geography. */
function getRealtorIdColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'county_fips';
    case 'zip':
      return 'postal_code';
    default:
      return 'cbsa_code';
  }
}

/** Find the latest Realtor period_date on or before the target date. */
async function getLatestRealtorDate(
  supabase: SupabaseClient,
  table: string,
  periodDate: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select('period_date')
    .lte('period_date', periodDate)
    .order('period_date', { ascending: false })
    .limit(1);

  return data?.[0]?.period_date ?? null;
}

/**
 * Fetch Realtor listing metrics: price_reduced_share, pending_listing_count_yy.
 * Used in county (price_reduced_share) and ZIP (pending_listing_count_yy) formulas.
 */
export async function fetchRealtorData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const table = getRealtorTable(geography);
  const idCol = getRealtorIdColumn(geography);

  const realtorDate = await getLatestRealtorDate(supabase, table, periodDate);
  if (!realtorDate) return;

  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, price_reduced_share, pending_listing_count_yy`)
      .eq('period_date', realtorDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      const location = locationsMap.get(r[idCol]);
      if (location) {
        if (r.price_reduced_share != null)
          location.price_reduced_share = r.price_reduced_share;
        if (r.pending_listing_count_yy != null)
          location.pending_listing_count_yy = r.pending_listing_count_yy;
      }
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
}

// Calculated Metrics (income_to_buy)
// ============================================================================

/** Find the latest calculated_metrics period_date for a geography type. */
async function getLatestCalcDate(
  supabase: SupabaseClient,
  geoType: string,
  periodDate: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('calculated_metrics')
    .select('period_date')
    .eq('geography_type', geoType)
    .lte('period_date', periodDate)
    .order('period_date', { ascending: false })
    .limit(1);

  return data?.[0]?.period_date ?? null;
}

/**
 * Fetch income_to_buy from the calculated_metrics table.
 * Maps to calc_income_to_buy in LocationMetrics.
 */
export async function fetchCalculatedMetrics(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const calcDate = await getLatestCalcDate(supabase, geography, periodDate);
  if (!calcDate) return;

  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('calculated_metrics')
      .select('geography_id, income_to_buy')
      .eq('geography_type', geography)
      .eq('period_date', calcDate)
      .order('geography_id', { ascending: true })
      .range(from, to);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      const location = locationsMap.get(r.geography_id);
      if (location && r.income_to_buy != null) {
        location.calc_income_to_buy = r.income_to_buy;
      }
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
}

// FRED Macro (VIX — national scalar)
// ============================================================================

/**
 * Fetch VIX from fred_macro table. Assigns the same value to all locations.
 * Gracefully returns if the fred_macro table doesn't exist yet.
 */
export async function fetchFredMacro(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  periodDate: string,
): Promise<void> {
  // Find latest VIX value on or before periodDate
  const { data, error } = await supabase
    .from('fred_macro')
    .select('value')
    .eq('indicator_name', 'vix')
    .lte('period_date', periodDate)
    .order('period_date', { ascending: false })
    .limit(1);

  // Gracefully skip if table doesn't exist or no data
  if (error || !data || data.length === 0) return;

  const vixValue = data[0].value;
  if (vixValue == null) return;

  for (const location of locationsMap.values()) {
    location.fred_vix = vixValue;
  }
}
