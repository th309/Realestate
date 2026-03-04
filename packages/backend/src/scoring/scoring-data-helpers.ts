/**
 * Scoring Data Helpers (v3.0)
 *
 * Table/column lookup functions and date fallback helpers used by
 * scoring-data-fetcher.ts and scoring-zillow-fetcher.ts.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';

/** Pagination size for all scoring data queries. */
export const PAGE_SIZE = 1000;

// ============================================================================
// Table Lookups
// ============================================================================

export function getRedfinTable(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'redfin_metro';
    case 'county':
      return 'redfin_county';
    case 'zip':
      return 'redfin_zip';
    default:
      return 'redfin_metro';
  }
}

export function getZillowTable(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'zillow_metro';
    case 'county':
      return 'zillow_county';
    case 'zip':
      return 'zillow_zip';
    default:
      return 'zillow_metro';
  }
}

// ============================================================================
// Column Lookups
// ============================================================================

/** Redfin ID column per geography (used as location_id key). */
export function getRedfinIdColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'zip':
      return 'zip_code';
    default:
      return 'cbsa_code';
  }
}

/** Redfin name column per geography. */
export function getRedfinNameColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'region_name';
    case 'county':
      return 'county_name';
    case 'zip':
      return 'zip_code'; // ZIP has no name column; use zip_code
    default:
      return 'region_name';
  }
}

/** Zillow long-format ID column per geography. */
export function getZillowIdColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'zip':
      return 'region_name'; // zillow_zip has no zip ID col; region_name contains zip
    default:
      return 'cbsa_code';
  }
}

/** Census ID column per geography. */
export function getCensusIdColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'zip':
      return 'zcta';
    default:
      return 'cbsa_code';
  }
}

/** Crosswalk column that matches our location_id keys. */
export function getCrosswalkColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'county':
      return 'county_fips'; // crosswalk uses county_fips, Redfin uses fips_code — same values
    case 'zip':
      return 'zip_code';
    default:
      return 'cbsa_code';
  }
}

// ============================================================================
// Date Conversion Helpers
// ============================================================================

/** Convert any date to end-of-month (Redfin uses period_end = last day of month). */
export function toEndOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// ============================================================================
// Date Fallback Helpers
// ============================================================================

/**
 * Find the latest census year available up to targetYear.
 * Census ACS data typically lags 1-2 years (e.g., 2023 data in 2025).
 */
export async function getLatestCensusYear(
  supabase: SupabaseClient,
  table: string,
  targetYear: number,
): Promise<number | null> {
  const { data } = await supabase
    .from(table)
    .select('year')
    .lte('year', targetYear)
    .order('year', { ascending: false })
    .limit(1);

  return data?.[0]?.year ?? null;
}

/**
 * Find the latest economic period_date on or before the target date.
 */
export async function getLatestEconomicDate(
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
 * Find the latest Zillow period_date on or before periodDate for a given metric.
 */
export async function getLatestZillowDate(
  supabase: SupabaseClient,
  table: string,
  metricName: string,
  periodDate: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select('period_date')
    .eq('metric_name', metricName)
    .lte('period_date', periodDate)
    .order('period_date', { ascending: false })
    .limit(1);

  return data?.[0]?.period_date ?? null;
}

/** Helper: paginated fetch of Zillow metric values keyed by idCol. */
export async function fetchZillowValues(
  supabase: SupabaseClient,
  table: string,
  idCol: string,
  metricName: string,
  periodDate: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, value`)
      .eq('metric_name', metricName)
      .eq('period_date', periodDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const r = row as Record<string, any>;
      if (r.value != null) result.set(r[idCol], r.value);
    }
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return result;
}
