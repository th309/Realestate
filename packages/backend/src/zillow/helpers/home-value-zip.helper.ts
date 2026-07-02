/**
 * ZHVI ZIP-Level Home Value Helpers
 *
 * ZIP-grain home value fetchers extracted from zillow.service.ts for
 * file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStateToCode } from '../../common/geo';
import type { HomeValueData } from '../types';
import { getLatestDate } from './queries';

export async function getZipHomeValues(
  supabase: SupabaseClient,
  stateFilter: string,
  countyFilter?: string,
  date?: string,
): Promise<HomeValueData[]> {
  const stateCode = stateFilter ? normalizeStateToCode(stateFilter) : undefined;
  if (!stateCode) {
    return [];
  }

  // Use cached latest date if not provided
  const targetDate = date || (await getLatestDate(supabase, 'zip', 'zhvi'));

  // Supabase has a 1000 row limit per request, so we need to paginate
  // for states with many ZIPs (CA has ~1700)
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    let query = supabase
      .from('zillow_zip')
      .select(
        'region_id, region_name, state_code, county_fips, value, period_date',
      )
      .eq('metric_name', 'zhvi')
      .eq('state_code', stateCode.toUpperCase());

    if (targetDate) {
      query = query.eq('period_date', targetDate);
    }

    const { data: pageData, error } = await query.range(
      page * pageSize,
      (page + 1) * pageSize - 1,
    );

    if (error) {
      throw new Error(`Error fetching ZIP home values: ${error.message}`);
    }

    if (!pageData || pageData.length === 0) break;

    allData.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    page++;
  }

  if (allData.length === 0) return [];

  // Map results (already filtered by date, no dedup needed)
  const results: HomeValueData[] = allData.map((record) => ({
    region_id: String(record.region_id),
    region_name: record.region_name,
    zip_code: record.region_name,
    state_abbrev: record.state_code,
    state_name: null,
    value: Number(record.value),
    date: record.period_date,
    property_type: 'sfrcondo',
    geography: 'ZIP',
  }));

  return results.sort((a, b) => b.value - a.value);
}

/**
 * Get all ZIP home values without state filter (with limit for performance)
 */
export async function getAllZipHomeValues(
  supabase: SupabaseClient,
  date?: string,
  limit: number = 100,
): Promise<HomeValueData[]> {
  try {
    // Use cached latest date if not provided
    const targetDate = date || (await getLatestDate(supabase, 'zip', 'zhvi'));

    console.log(
      `getAllZipHomeValues: targetDate=${targetDate}, limit=${limit}`,
    );

    // Query all ZIPs with a limit, ordered by value descending
    const { data: zipData, error } = await supabase
      .from('zillow_zip')
      .select(
        'region_id, region_name, state_code, county_fips, value, period_date',
      )
      .eq('metric_name', 'zhvi')
      .eq('period_date', targetDate)
      .order('value', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`getAllZipHomeValues error: ${error.message}`);
      return []; // Return empty instead of throwing
    }

    if (!zipData || zipData.length === 0) {
      console.log(`getAllZipHomeValues: no data found for date ${targetDate}`);
      return [];
    }

    console.log(`getAllZipHomeValues: found ${zipData.length} records`);

    // Map results
    return zipData.map((record) => ({
      region_id: String(record.region_id),
      region_name: record.region_name,
      zip_code: record.region_name,
      state_abbrev: record.state_code,
      state_name: null,
      value: Number(record.value),
      date: record.period_date,
      property_type: 'sfrcondo',
      geography: 'ZIP',
    }));
  } catch (err) {
    console.error(`getAllZipHomeValues unexpected error:`, err);
    return []; // Return empty on error
  }
}
