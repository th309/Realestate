import { SupabaseClient } from '@supabase/supabase-js';
import { CensusDataPoint, CensusRow } from './census.types';
import { CensusCache } from './census-cache';
import { toMetricValue } from './census-value.helper';

export async function getLatestYear(
  supabase: SupabaseClient,
  table: string,
): Promise<number | null> {
  const { data } = await supabase
    .from(table)
    .select('year')
    .order('year', { ascending: false })
    .limit(1);

  return (data?.[0] as CensusRow)?.year as number | null;
}

export async function getNationalData(
  supabase: SupabaseClient,
  metric: string,
  year?: number,
): Promise<CensusDataPoint[]> {
  const latestYear = year || (await getLatestYear(supabase, 'census_national'));

  const { data, error } = await supabase
    .from('census_national')
    .select(`year, ${metric}`)
    .eq('year', latestYear)
    .limit(1);

  if (error) throw error;

  return ((data || []) as unknown as CensusRow[]).map((row) => ({
    region_id: 'US',
    region_name: 'United States',
    value: toMetricValue(row[metric]),
    year: latestYear ?? undefined,
  }));
}

export async function getStateData(
  supabase: SupabaseClient,
  cache: CensusCache,
  metric: string,
  year?: number,
): Promise<CensusDataPoint[]> {
  const cacheKey = `census_state:${metric}:${year || 'latest'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.map((row) => ({
      region_id: String(row.state_fips || ''),
      region_name: String(row.state_name || ''),
      value: toMetricValue(row[metric]),
      year: row.year as number,
      state_fips: String(row.state_fips || ''),
    }));
  }

  const latestYear = year || (await getLatestYear(supabase, 'census_state'));

  const { data, error } = await supabase
    .from('census_state')
    .select(`year, state_fips, state_name, ${metric}`)
    .eq('year', latestYear);

  if (error) throw error;
  cache.set(cacheKey, data as unknown as CensusRow[]);

  return ((data || []) as unknown as CensusRow[]).map((row) => ({
    region_id: String(row.state_fips || ''),
    region_name: String(row.state_name || ''),
    value: toMetricValue(row[metric]),
    year: latestYear ?? undefined,
    state_fips: String(row.state_fips || ''),
  }));
}

export async function getMetroData(
  supabase: SupabaseClient,
  cache: CensusCache,
  metric: string,
  year?: number,
): Promise<CensusDataPoint[]> {
  const cacheKey = `census_metro:${metric}:${year || 'latest'}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached.map((row) => ({
      region_id: String(row.cbsa_code || ''),
      region_name: String(row.cbsa_title || ''),
      value: toMetricValue(row[metric]),
      year: row.year as number,
      cbsa_code: String(row.cbsa_code || ''),
    }));
  }

  const latestYear = year || (await getLatestYear(supabase, 'census_metro'));

  const { data, error } = await supabase
    .from('census_metro')
    .select(`year, cbsa_code, cbsa_title, ${metric}`)
    .eq('year', latestYear);

  if (error) throw error;
  cache.set(cacheKey, data as unknown as CensusRow[]);

  return ((data || []) as unknown as CensusRow[]).map((row) => ({
    region_id: String(row.cbsa_code || ''),
    region_name: String(row.cbsa_title || ''),
    value: toMetricValue(row[metric]),
    year: latestYear ?? undefined,
    cbsa_code: String(row.cbsa_code || ''),
  }));
}
