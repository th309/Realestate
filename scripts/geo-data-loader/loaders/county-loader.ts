/**
 * County Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient, linkMarketsToTiger, buildHierarchy } from '../db-client';

/**
 * Load counties from TIGER data
 */
export async function loadCounties(): Promise<LoadResult> {
  console.log('\nSTEP 5: Loading Counties from TIGER...');
  const supabase = createSupabaseAdminClient();

  try {
    const { data: counties, error } = await supabase
      .from('tiger_counties')
      .select('geoid, name, state_fips, geometry')
      .order('geoid');

    if (error) throw error;

    const markets = counties?.map(county => ({
      region_id: `US-COUNTY-${county.geoid}`,
      region_name: county.name,
      region_type: 'county',
      state_code: county.state_fips,
      county_fips: county.geoid,
      geoid: county.geoid,
      geometry: county.geometry,
      external_ids: {
        tiger_county_geoid: county.geoid
      }
    })) || [];

    if (markets.length > 0) {
      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, { onConflict: 'region_id' });

      if (insertError) throw insertError;
    }

    console.log(`Loaded ${markets.length} counties`);

    const recordsLinked = await linkMarketsToTiger();
    const relationshipsCreated = await buildHierarchy();

    return {
      level: 'counties',
      recordsLoaded: markets.length,
      recordsLinked,
      relationshipsCreated,
      success: true
    };
  } catch (error: any) {
    console.error('Error loading counties:', error);
    return {
      level: 'counties',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    };
  }
}
