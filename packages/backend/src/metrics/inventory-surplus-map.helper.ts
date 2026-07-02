import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStateToCode } from '../common/geo';
import {
  CacheEntry,
  GeographyType,
  PAGE_SIZE,
} from './inventory-surplus.types';
import {
  getCachedEntry,
  setCachedEntry,
  getCachedDate,
  setCachedDate,
} from './inventory-surplus-cache.helper';
import { transformToApiFormat } from './inventory-surplus-calculation.helper';

/**
 * Get pre-calculated inventory surplus data for map display
 * For ZIP geography, pass state to filter at database level for faster queries
 */
export async function getForMap(
  supabase: SupabaseClient,
  cache: Map<string, CacheEntry<any[]>>,
  latestDateCache: Map<string, CacheEntry<string>>,
  geographyType: GeographyType,
  state?: string,
): Promise<{ data: any[]; success: boolean; source: string }> {
  if (state) state = normalizeStateToCode(state);
  // For zip, do not filter by state: return all zips for the date so the map can look up by postal_code
  // (map only loads state-specific GeoJSON and uses mapData[zipCode] - same as income-to-buy)
  const cacheKey =
    geographyType === 'zip'
      ? `inventory_surplus:zip`
      : state
        ? `inventory_surplus:${geographyType}:${state.toLowerCase()}`
        : `inventory_surplus:${geographyType}`;

  // Check cache first
  const cached = getCachedEntry<any[]>(cache, cacheKey);
  if (cached) {
    return {
      data: cached,
      success: true,
      source: 'calculated_metrics (cached)',
    };
  }

  // Get the latest period_date for this geography type (with caching)
  const dateCacheKey = `inventory_surplus_date:${geographyType}`;
  let latestDate = getCachedDate(latestDateCache, dateCacheKey);

  if (!latestDate) {
    const { data: latestRow } = await supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geographyType)
      .not('inventory_surplus_pct', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }
    latestDate = latestRow.period_date;
    setCachedDate(latestDateCache, dateCacheKey, latestDate!);
  }

  // At this point latestDate is guaranteed to be a string
  const effectiveDate: string = latestDate!;

  // ZIP: return all zips for the date (no state filter). Map uses state-specific GeoJSON and looks up by postal_code.
  // Get all data for that period (paginated for large datasets)
  const allData: any[] = [];
  let offset = 0;

  while (true) {
    const { data: pageData } = await supabase
      .from('calculated_metrics')
      .select(
        'geography_id, geography_name, inventory_surplus_pct, period_date',
      )
      .eq('geography_type', geographyType)
      .eq('period_date', effectiveDate)
      .not('inventory_surplus_pct', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!pageData || pageData.length === 0) break;
    allData.push(...pageData);
    if (pageData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Transform to API format
  const results = transformToApiFormat(allData, geographyType);
  setCachedEntry(cache, cacheKey, results);

  return { data: results, success: true, source: 'calculated_metrics' };
}

/**
 * Fetch ZIP inventory surplus data filtered by state at database level
 * This is MUCH faster than loading all 28,000+ ZIPs and filtering in memory
 */
export async function fetchZipsByState(
  supabase: SupabaseClient,
  periodDate: string,
  state: string,
): Promise<any[]> {
  // geography_name format is "city, ST" so we use ilike to match state suffix
  const statePattern = `%, ${state.toLowerCase()}`;
  const allData: any[] = [];
  let offset = 0;

  while (true) {
    const { data: pageData } = await supabase
      .from('calculated_metrics')
      .select(
        'geography_id, geography_name, inventory_surplus_pct, period_date',
      )
      .eq('geography_type', 'zip')
      .eq('period_date', periodDate)
      .ilike('geography_name', statePattern)
      .not('inventory_surplus_pct', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!pageData || pageData.length === 0) break;
    allData.push(...pageData);
    if (pageData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return transformToApiFormat(allData, 'zip');
}
