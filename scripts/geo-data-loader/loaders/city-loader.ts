/**
 * City (Places) Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient, linkMarketsToTiger, buildHierarchy } from '../db-client';

const BATCH_SIZE = 1000;

/**
 * Load cities (places) from TIGER data
 */
export async function loadCities(): Promise<LoadResult> {
  console.log('\nSTEP 4: Loading Cities (Places) from TIGER...');
  const supabase = createSupabaseAdminClient();

  try {
    let offset = 0;
    let totalLoaded = 0;

    while (true) {
      const { data: places, error } = await supabase
        .from('tiger_places')
        .select('geoid, name, state_fips, geometry')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('geoid');

      if (error) throw error;
      if (!places || places.length === 0) break;

      const markets = places.map(place => ({
        region_id: `US-CITY-${place.geoid}`,
        region_name: place.name,
        region_type: 'city',
        state_code: place.state_fips,
        geoid: place.geoid,
        geometry: place.geometry,
        external_ids: {
          tiger_place_geoid: place.geoid
        }
      }));

      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, { onConflict: 'region_id' });

      if (insertError) throw insertError;

      totalLoaded += markets.length;
      offset += BATCH_SIZE;

      console.log(`  Loaded ${totalLoaded} cities...`);

      if (places.length < BATCH_SIZE) break;
    }

    console.log(`Loaded ${totalLoaded} cities total`);

    const recordsLinked = await linkMarketsToTiger();
    const relationshipsCreated = await buildHierarchy();

    return {
      level: 'cities',
      recordsLoaded: totalLoaded,
      recordsLinked,
      relationshipsCreated,
      success: true
    };
  } catch (error: any) {
    console.error('Error loading cities:', error);
    return {
      level: 'cities',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    };
  }
}
