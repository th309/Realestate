/**
 * GeoID lookup for Redfin region names.
 *
 * Redfin TSV files identify regions by name + type (e.g., "Phoenix, AZ" / "metro"),
 * not by standard FIPS or CBSA codes. This module resolves those region names to
 * standard geographic identifiers by querying the tiger_states, tiger_counties,
 * tiger_cbsa, and tiger_zcta lookup tables in Supabase.
 *
 * A persistent in-memory cache (regionKey -> geoid) avoids redundant lookups
 * within a single import run. Cache keys have the format:
 *   "regionType|stateCode|regionName"
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** In-memory cache of resolved region keys to geoids. */
const resolvedGeoidCache = new Map<string, string>();

/**
 * Build a cache key for a region.
 */
export function buildRegionCacheKey(regionType: string, regionName: string, stateCode?: string): string {
  return `${regionType}|${stateCode || ''}|${regionName}`;
}

/**
 * Get a cached geoid, or null if not yet resolved.
 */
export function getCachedGeoid(cacheKey: string): string | null {
  return resolvedGeoidCache.get(cacheKey) ?? null;
}

/**
 * Store a geoid in the cache.
 */
export function cacheGeoid(cacheKey: string, geoid: string): void {
  resolvedGeoidCache.set(cacheKey, geoid);
}

/**
 * Clear the geoid cache (useful between import runs in tests).
 */
export function clearGeoidCache(): void {
  resolvedGeoidCache.clear();
}

/**
 * Get the current cache size.
 */
export function getGeoidCacheSize(): number {
  return resolvedGeoidCache.size;
}

// ---------------------------------------------------------------------------
// Lookup functions for each geography type
// ---------------------------------------------------------------------------

async function lookupStateGeoid(
  supabase: SupabaseClient,
  regionName: string,
  stateCode?: string,
): Promise<string | null> {
  let query = supabase.from('tiger_states').select('geoid, name, state_abbreviation');

  if (stateCode) {
    query = query.eq('state_abbreviation', stateCode.toUpperCase());
  } else {
    const cleanName = regionName.replace(/,?\s*[A-Z]{2}$/, '').trim();
    query = query.ilike('name', `%${cleanName}%`);
  }

  const { data } = await query.limit(1).maybeSingle();
  return data?.geoid ?? null;
}

async function lookupMetroGeoid(
  supabase: SupabaseClient,
  regionName: string,
): Promise<string | null> {
  const cleanName = regionName.replace(/,?\s*[A-Z]{2}(-[A-Z]{2})?$/, '').trim();

  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .ilike('name', cleanName)
    .limit(1)
    .maybeSingle();

  if (exactMatch?.geoid) return exactMatch.geoid;

  // Fall back to partial match
  const { data: partialMatch } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .ilike('name', `%${cleanName}%`)
    .limit(1)
    .maybeSingle();

  return partialMatch?.geoid ?? null;
}

async function lookupCountyGeoid(
  supabase: SupabaseClient,
  regionName: string,
  stateCode: string,
): Promise<string | null> {
  const cleanCountyName = regionName
    .replace(/,?\s*[A-Z]{2}$/, '')
    .replace(/\s+County$/i, '')
    .trim();

  // Get state FIPS from abbreviation
  const { data: stateData } = await supabase
    .from('tiger_states')
    .select('geoid')
    .eq('state_abbreviation', stateCode.toUpperCase())
    .maybeSingle();

  if (!stateData?.geoid) return null;

  // Try exact match within that state
  const { data: exactCounty } = await supabase
    .from('tiger_counties')
    .select('geoid, name')
    .eq('state_fips', stateData.geoid)
    .ilike('name', cleanCountyName)
    .limit(1)
    .maybeSingle();

  if (exactCounty?.geoid) return exactCounty.geoid;

  // Fall back to partial match
  const { data: partialCounty } = await supabase
    .from('tiger_counties')
    .select('geoid, name')
    .eq('state_fips', stateData.geoid)
    .ilike('name', `%${cleanCountyName}%`)
    .limit(1)
    .maybeSingle();

  return partialCounty?.geoid ?? null;
}

async function lookupZipGeoid(
  supabase: SupabaseClient,
  regionName: string,
): Promise<string | null> {
  const zipMatch = regionName.match(/\b(\d{5})\b/);
  if (!zipMatch) return null;

  const { data } = await supabase
    .from('tiger_zcta')
    .select('geoid')
    .eq('geoid', zipMatch[1])
    .maybeSingle();

  return data?.geoid ?? null;
}

/**
 * Generate a deterministic fallback geoid when no lookup table match is found.
 * Format: REDFIN-{TYPE}-{SANITIZED_NAME}
 */
function generateFallbackGeoid(regionType: string, regionName: string): string {
  const sanitizedName = regionName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toUpperCase()
    .substring(0, 30);
  return `REDFIN-${regionType.toUpperCase()}-${sanitizedName}`;
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

/**
 * Resolve a Redfin region to a standard geoid (FIPS, CBSA, ZCTA, etc.).
 *
 * Checks the in-memory cache first, then queries tiger lookup tables.
 * Falls back to a deterministic REDFIN-{TYPE}-{NAME} identifier if no match found.
 *
 * This function is safe to call repeatedly for the same region -- it will
 * return the cached result on subsequent calls.
 */
export async function resolveRedfinGeoid(
  supabase: SupabaseClient,
  regionType: string,
  regionName: string,
  stateCode?: string,
): Promise<string> {
  const normalizedType = regionType.toLowerCase();
  const cacheKey = buildRegionCacheKey(normalizedType, regionName, stateCode);

  // Check cache
  const cached = getCachedGeoid(cacheKey);
  if (cached) return cached;

  // Attempt lookup based on region type
  let geoid: string | null = null;

  try {
    if (normalizedType === 'state') {
      geoid = await lookupStateGeoid(supabase, regionName, stateCode);
    } else if (normalizedType === 'metro' || normalizedType === 'msa') {
      geoid = await lookupMetroGeoid(supabase, regionName);
    } else if (normalizedType === 'county' && stateCode) {
      geoid = await lookupCountyGeoid(supabase, regionName, stateCode);
    } else if (normalizedType === 'zip' || normalizedType === 'zipcode') {
      geoid = await lookupZipGeoid(supabase, regionName);
    }
    // city and neighborhood have no standard lookup table -- fall through to fallback
  } catch {
    // On any lookup error, fall through to fallback
  }

  const resolvedGeoid = geoid ?? generateFallbackGeoid(normalizedType, regionName);
  cacheGeoid(cacheKey, resolvedGeoid);
  return resolvedGeoid;
}
