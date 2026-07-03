/**
 * ZHVI Home Value Helpers
 *
 * Region-level (national/state/metro/county/city) home value fetchers extracted
 * from zillow.service.ts for file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStateToCode } from '../../common/geo';
import type { HomeValueData } from '../types';
import { getLatestDate } from './queries';
import { buildMetroMappings, lookupMetro } from './crosswalk';

export async function getNationalHomeValue(
  supabase: SupabaseClient,
): Promise<HomeValueData[]> {
  const { data, error } = await supabase
    .from('realtor_national')
    .select('period_date, median_listing_price')
    .order('period_date', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Error fetching national home value: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  return [
    {
      region_id: 'US',
      region_name: 'United States',
      value: Number(data[0].median_listing_price),
      date: data[0].period_date,
      property_type: 'sfrcondo',
      geography: 'National',
    },
  ];
}

export async function getStateHomeValues(
  supabase: SupabaseClient,
  date?: string,
): Promise<HomeValueData[]> {
  // Query zillow_state table directly - it has region_name (state name) built in
  const { data: stateData, error } = await supabase
    .from('zillow_state')
    .select('region_id, region_name, state_code, value, period_date')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false });

  if (error) {
    throw new Error(`Error fetching state home values: ${error.message}`);
  }

  if (!stateData || stateData.length === 0) return [];

  // Get the most recent value per state (data is ordered by date desc)
  const seenStates = new Set<number>();
  const results: HomeValueData[] = [];

  for (const record of stateData) {
    if (seenStates.has(record.region_id)) continue;
    seenStates.add(record.region_id);

    results.push({
      region_id: String(record.region_id),
      region_name: record.region_name,
      state_abbrev: record.state_code,
      state_name: record.region_name,
      value: Number(record.value),
      date: record.period_date,
      property_type: 'sfrcondo',
      geography: 'State',
    });
  }

  return results.sort((a, b) => b.value - a.value);
}

export async function getMetroHomeValues(
  supabase: SupabaseClient,
  date?: string,
  stateFilter?: string,
): Promise<HomeValueData[]> {
  stateFilter = stateFilter ? normalizeStateToCode(stateFilter) : undefined;
  // Use cached latest date if not provided
  const targetDate = date || (await getLatestDate(supabase, 'metro', 'zhvi'));

  // Query zillow_metro table directly - filter by date for efficiency
  let query = supabase
    .from('zillow_metro')
    .select('region_id, region_name, state_code, cbsa_code, value, period_date')
    .eq('metric_name', 'zhvi');

  if (targetDate) {
    query = query.eq('period_date', targetDate);
  }

  if (stateFilter) {
    query = query.eq('state_code', stateFilter.toUpperCase());
  }

  const { data: metroData, error } = await query.limit(2000);

  if (error) {
    throw new Error(`Error fetching metro home values: ${error.message}`);
  }

  if (!metroData || metroData.length === 0) return [];

  // Use the crosswalk to convert Zillow region IDs → real CBSA codes
  const { byZillowId, byCbsaCode } = await buildMetroMappings(supabase);

  const results: HomeValueData[] = metroData
    .map((record) => {
      const { metro, cbsaCode } = lookupMetro(
        String(record.region_id),
        byZillowId,
        byCbsaCode,
      );
      return {
        region_id: String(record.region_id),
        region_name: metro?.cbsa_name || record.region_name,
        cbsa_code: cbsaCode || record.cbsa_code,
        state_abbrev: metro?.state || record.state_code,
        value: Number(record.value),
        date: record.period_date,
        property_type: 'sfrcondo',
        geography: 'Metro',
      };
    })
    .filter((r) => r.cbsa_code); // Only include records we can map to a CBSA

  return results.sort((a, b) => b.value - a.value);
}

export async function getCountyHomeValues(
  supabase: SupabaseClient,
  date?: string,
  stateFilter?: string,
): Promise<HomeValueData[]> {
  stateFilter = stateFilter ? normalizeStateToCode(stateFilter) : undefined;
  // Use cached latest date if not provided
  const targetDate = date || (await getLatestDate(supabase, 'county', 'zhvi'));

  // Supabase has a 1000 row limit per request, so we need to paginate
  // to get all ~3200 counties
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    let query = supabase
      .from('zillow_county')
      .select(
        'region_id, region_name, state_code, fips_code, value, period_date',
      )
      .eq('metric_name', 'zhvi');

    if (targetDate) {
      query = query.eq('period_date', targetDate);
    }

    if (stateFilter) {
      query = query.eq('state_code', stateFilter.toUpperCase());
    }

    const { data: pageData, error } = await query.range(
      page * pageSize,
      (page + 1) * pageSize - 1,
    );

    if (error) {
      throw new Error(`Error fetching county home values: ${error.message}`);
    }

    if (!pageData || pageData.length === 0) break;

    allData.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    page++;
  }

  if (allData.length === 0) return [];

  // Map results (already filtered by date, no dedup needed)
  const results: HomeValueData[] = allData
    .filter((record) => record.fips_code) // Skip records without fips_code
    .map((record) => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      county_fips: record.fips_code,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: 'sfrcondo',
      geography: 'County',
    }));

  return results.sort((a, b) => b.value - a.value);
}

export async function getCityHomeValues(
  supabase: SupabaseClient,
  stateFilter?: string,
): Promise<HomeValueData[]> {
  stateFilter = stateFilter ? normalizeStateToCode(stateFilter) : undefined;
  if (!stateFilter) {
    return []; // Return empty - cities require state filter
  }

  // Use cached latest date
  const targetDate = await getLatestDate(supabase, 'city', 'zhvi');
  if (!targetDate) return [];

  // Query zillow_city table - filter by state AND date for efficiency
  const { data: cityData, error } = await supabase
    .from('zillow_city')
    .select(
      'region_id, region_name, state_code, metro_region_id, value, period_date',
    )
    .eq('metric_name', 'zhvi')
    .eq('state_code', stateFilter.toUpperCase())
    .eq('period_date', targetDate)
    .limit(5000);

  if (error) {
    throw new Error(`Error fetching city home values: ${error.message}`);
  }

  if (!cityData || cityData.length === 0) return [];

  // Map results (already filtered by date, no dedup needed)
  const results: HomeValueData[] = cityData.map((record) => ({
    region_id: String(record.region_id),
    region_name: record.region_name,
    state_abbrev: record.state_code,
    state_name: null,
    value: Number(record.value),
    date: record.period_date,
    property_type: 'sfrcondo',
    geography: 'City',
  }));

  return results.sort((a, b) => b.value - a.value);
}
