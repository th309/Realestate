/**
 * Crosswalk Helpers
 * Reusable functions for building geography crosswalk maps
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  StateMapping,
  MetroMapping,
  CountyMapping,
  ZipMapping,
} from '../types';

// ============================================================================
// In-memory cache for crosswalk data (rarely changes, expensive to fetch)
// ============================================================================
interface MetroMappingsCache {
  byZillowId: Map<string, MetroMapping>;
  byCbsaCode: Map<string, MetroMapping>;
  timestamp: number;
}

let metroMappingsCache: MetroMappingsCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cache for ZIP mappings by state (key: stateFilter, value: cached result)
const zipMappingsCache = new Map<
  string,
  { data: Map<string, ZipMapping>; timestamp: number }
>();

const US_STATE_ABBREVS = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'VI',
  'PR',
];

/**
 * Build state mappings from Zillow region IDs to state info
 * Optimized: Single query instead of 53 separate queries
 */
export async function buildStateMappings(
  supabase: SupabaseClient,
): Promise<Map<string, StateMapping>> {
  const stateMap = new Map<string, StateMapping>();

  // Single query to get all state mappings
  const { data } = await supabase
    .from('geography_crosswalk')
    .select('state_abbrev, state_name, zillow_state_region_id')
    .in('state_abbrev', US_STATE_ABBREVS)
    .not('zillow_state_region_id', 'is', null)
    .limit(100);

  // Deduplicate by zillow_state_region_id
  const seen = new Set<number>();
  data?.forEach((row) => {
    if (row.zillow_state_region_id && !seen.has(row.zillow_state_region_id)) {
      seen.add(row.zillow_state_region_id);
      stateMap.set(String(row.zillow_state_region_id), {
        abbrev: row.state_abbrev,
        name: row.state_name,
      });
    }
  });

  return stateMap;
}

/**
 * Extract state abbreviation from CBSA title (e.g., "Peoria, IL" -> "IL")
 */
function extractStateFromCbsaTitle(cbsaTitle: string | null): string | null {
  if (!cbsaTitle) return null;
  // CBSA titles end with state abbreviation(s) like "Peoria, IL" or "Chicago-Naperville-Elgin, IL-IN-WI"
  const match = cbsaTitle.match(/,\s*([A-Z]{2})(?:-[A-Z]{2})*$/);
  return match ? match[1] : null;
}

/**
 * Build metro mappings from both Zillow IDs and CBSA codes
 * Uses zillow_metro_crosswalk table
 * OPTIMIZED: Results are cached for 1 hour since crosswalk data rarely changes
 */
export async function buildMetroMappings(
  supabase: SupabaseClient,
  stateFilter?: string,
): Promise<{
  byZillowId: Map<string, MetroMapping>;
  byCbsaCode: Map<string, MetroMapping>;
}> {
  // Return cached data if still valid (stateFilter not used, so cache is global)
  if (
    metroMappingsCache &&
    Date.now() - metroMappingsCache.timestamp < CACHE_TTL_MS
  ) {
    return {
      byZillowId: metroMappingsCache.byZillowId,
      byCbsaCode: metroMappingsCache.byCbsaCode,
    };
  }

  const byZillowId = new Map<string, MetroMapping>();
  const byCbsaCode = new Map<string, MetroMapping>();

  let page = 0;
  const pageSize = 1000;

  while (true) {
    const query = supabase
      .from('zillow_metro_crosswalk')
      .select('cbsa_code, cbsa_title, zillow_region_id, zillow_state_name')
      .not('cbsa_code', 'is', null);

    // Note: stateFilter expects abbreviation but zillow_state_name is full name
    // For now, skip state filtering on this table - it's only ~900 metros anyway

    const { data: crosswalk } = await query.range(
      page * pageSize,
      (page + 1) * pageSize - 1,
    );

    if (!crosswalk || crosswalk.length === 0) break;

    crosswalk.forEach((row) => {
      const stateAbbrev = extractStateFromCbsaTitle(row.cbsa_title);

      const metroInfo: MetroMapping = {
        cbsa_code: row.cbsa_code,
        cbsa_name: row.cbsa_title,
        state: stateAbbrev,
      };

      if (
        row.zillow_region_id &&
        !byZillowId.has(String(row.zillow_region_id))
      ) {
        byZillowId.set(String(row.zillow_region_id), metroInfo);
      }
      if (row.cbsa_code && !byCbsaCode.has(row.cbsa_code)) {
        byCbsaCode.set(row.cbsa_code, metroInfo);
      }
    });

    page++;
    if (crosswalk.length < pageSize) break;
  }

  // Cache the results
  metroMappingsCache = { byZillowId, byCbsaCode, timestamp: Date.now() };

  return { byZillowId, byCbsaCode };
}

/**
 * Build county mappings from FIPS codes
 */
export async function buildCountyMappings(
  supabase: SupabaseClient,
  stateFilter?: string,
): Promise<Map<string, CountyMapping>> {
  const countyMap = new Map<string, CountyMapping>();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from('geography_crosswalk')
      .select('county_fips, county_name, state_abbrev, state_name')
      .not('county_fips', 'is', null);

    if (stateFilter) {
      query = query.eq('state_abbrev', stateFilter);
    }

    const { data: crosswalk } = await query.range(
      page * pageSize,
      (page + 1) * pageSize - 1,
    );

    if (!crosswalk || crosswalk.length === 0) break;

    crosswalk.forEach((row) => {
      if (row.county_fips && !countyMap.has(row.county_fips)) {
        countyMap.set(row.county_fips, {
          fips: row.county_fips,
          name: row.county_name,
          state_abbrev: row.state_abbrev,
          state_name: row.state_name,
        });
      }
    });

    page++;
    if (crosswalk.length < pageSize) break;
  }

  return countyMap;
}

/**
 * Build ZIP code mappings (with 1-hour cache per state)
 */
export async function buildZipMappings(
  supabase: SupabaseClient,
  stateFilter: string,
  countyFilter?: string,
): Promise<Map<string, ZipMapping>> {
  // Check cache (only for state-only queries, not county-filtered)
  const cacheKey = countyFilter
    ? `${stateFilter}:${countyFilter}`
    : stateFilter;
  const cached = zipMappingsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let query = supabase
    .from('geography_crosswalk')
    .select('zip_code, zip_default_city, county_name, state_abbrev, state_name')
    .eq('state_abbrev', stateFilter);

  if (countyFilter) {
    query = query.eq('county_fips', countyFilter);
  }

  const { data: crosswalk } = await query.limit(3000);

  const zipMap = new Map<string, ZipMapping>();

  crosswalk?.forEach((row) => {
    if (row.zip_code) {
      zipMap.set(row.zip_code, {
        city: row.zip_default_city,
        county: row.county_name,
        state_abbrev: row.state_abbrev,
        state_name: row.state_name,
      });
    }
  });

  // Cache the result
  zipMappingsCache.set(cacheKey, { data: zipMap, timestamp: Date.now() });

  return zipMap;
}

/**
 * Look up metro info from either CBSA code or Zillow ID
 */
export function lookupMetro(
  regionId: string,
  byZillowId: Map<string, MetroMapping>,
  byCbsaCode: Map<string, MetroMapping>,
): { metro: MetroMapping | undefined; cbsaCode: string | null } {
  const is5DigitCode = /^\d{5}$/.test(regionId);

  let metro: MetroMapping | undefined;
  let cbsaCode: string | null = null;

  if (is5DigitCode) {
    metro = byCbsaCode.get(regionId);
    if (metro) {
      cbsaCode = regionId;
    }
  }

  if (!metro) {
    metro = byZillowId.get(regionId);
    if (metro) {
      cbsaCode = metro.cbsa_code;
    }
  }

  return { metro, cbsaCode };
}
