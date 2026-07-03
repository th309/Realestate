import { SupabaseClient } from '@supabase/supabase-js';
import { CensusDataPoint, CensusRow } from './census.types';
import { CensusCache } from './census-cache';
import { toStateFips, toMetricValue } from './census-value.helper';
import { getLatestYear } from './census-fetchers.helper';

export async function getCountyData(
  supabase: SupabaseClient,
  cache: CensusCache,
  metric: string,
  year?: number,
): Promise<CensusDataPoint[]> {
  const cacheKey = `census_county:${metric}:${year || 'latest'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.map((row) => ({
      region_id: String(row.fips_code || ''),
      region_name: String(row.county_name || ''),
      value: toMetricValue(row[metric]),
      year: row.year as number,
      fips_code: String(row.fips_code || ''),
      state_fips: String(row.state_fips || ''),
    }));
  }

  const latestYear = year || (await getLatestYear(supabase, 'census_county'));

  // Paginate to handle all ~3,200 US counties (Supabase default limit is 1000)
  const allData: CensusRow[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('census_county')
      .select(`year, fips_code, county_name, state_fips, ${metric}`)
      .eq('year', latestYear)
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData.push(...(data as unknown as CensusRow[]));
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  cache.set(cacheKey, allData);

  return allData.map((row) => ({
    region_id: String(row.fips_code || ''),
    region_name: String(row.county_name || ''),
    value: toMetricValue(row[metric]),
    year: latestYear ?? undefined,
    fips_code: String(row.fips_code || ''),
    state_fips: String(row.state_fips || ''),
  }));
}

export async function getCityData(
  supabase: SupabaseClient,
  cache: CensusCache,
  metric: string,
  year?: number,
  state?: string,
): Promise<CensusDataPoint[]> {
  const cacheKey = `census_city:${metric}:${year || 'latest'}:${state || 'all'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.map((row) => ({
      region_id: String(row.place_fips || ''),
      region_name: String(row.place_name || ''),
      value: toMetricValue(row[metric]),
      year: row.year as number,
      place_fips: String(row.place_fips || ''),
      state_fips: String(row.state_fips || ''),
    }));
  }

  const latestYear = year || (await getLatestYear(supabase, 'census_city'));

  // Paginate to handle states with >1000 cities (Supabase default limit)
  const allData: CensusRow[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabase
      .from('census_city')
      .select(`year, place_fips, place_name, state_fips, ${metric}`)
      .eq('year', latestYear)
      .range(offset, offset + batchSize - 1);

    if (state) {
      query = query.eq('state_fips', toStateFips(state));
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allData.push(...(data as unknown as CensusRow[]));
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  cache.set(cacheKey, allData);

  return allData.map((row) => ({
    region_id: String(row.place_fips || ''),
    region_name: String(row.place_name || ''),
    value: toMetricValue(row[metric]),
    year: latestYear ?? undefined,
    place_fips: String(row.place_fips || ''),
    state_fips: String(row.state_fips || ''),
  }));
}

export async function getZipData(
  supabase: SupabaseClient,
  cache: CensusCache,
  metric: string,
  year?: number,
  _state?: string, // Note: state filter ignored - ZCTAs can span state boundaries and Census API doesn't provide state info
): Promise<CensusDataPoint[]> {
  // Cache key ignores state since we always load all ZCTAs (map handles geographic filtering)
  const cacheKey = `census_zip:${metric}:${year || 'latest'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.map((row) => ({
      region_id: String(row.zcta || ''),
      region_name: String(row.zcta || ''),
      value: toMetricValue(row.metric_value),
      year: row.year as number,
      zcta: String(row.zcta || ''),
    }));
  }

  // Use optimized database function to get only latest data per ZCTA
  // Paginate RPC results since Supabase enforces 1000-row limit regardless of .limit()
  const allRows: CensusRow[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .rpc('get_latest_census_zip', { p_metric: metric })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...(data as CensusRow[]));
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  cache.set(cacheKey, allRows);

  return allRows.map((row) => ({
    region_id: String(row.zcta || ''),
    region_name: String(row.zcta || ''),
    value: toMetricValue(row.metric_value),
    year: row.year as number,
    zcta: String(row.zcta || ''),
  }));
}
