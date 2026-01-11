/**
 * Zip Code (ZCTA) Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient, linkMarketsToTiger, buildHierarchy } from '../db-client';

const BATCH_SIZE = 1000;

/**
 * Load zip codes (ZCTAs) from TIGER data
 */
export async function loadZipCodes(): Promise<LoadResult> {
  console.log('\nSTEP 6: Loading Zip Codes (ZCTA) from TIGER...');
  const supabase = createSupabaseAdminClient();

  try {
    // Check if ZCTA data exists
    const { count, error: countError } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true });

    if (countError || !count || count === 0) {
      console.log('No ZCTA data in tiger_zcta table. Skipping zip codes.');
      return {
        level: 'zipcodes',
        recordsLoaded: 0,
        recordsLinked: 0,
        relationshipsCreated: 0,
        success: true,
        error: 'No ZCTA data available'
      };
    }

    let offset = 0;
    let totalLoaded = 0;

    while (true) {
      const { data: zctas, error } = await supabase
        .from('tiger_zcta')
        .select('geoid, geometry')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('geoid');

      if (error) throw error;
      if (!zctas || zctas.length === 0) break;

      const markets = zctas.map(zcta => ({
        region_id: `US-ZIP-${zcta.geoid}`,
        region_name: `ZIP ${zcta.geoid}`,
        region_type: 'zip',
        geoid: zcta.geoid,
        geometry: zcta.geometry,
        external_ids: {
          tiger_zcta_geoid: zcta.geoid
        }
      }));

      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, { onConflict: 'region_id' });

      if (insertError) throw insertError;

      totalLoaded += markets.length;
      offset += BATCH_SIZE;

      console.log(`  Loaded ${totalLoaded} zip codes...`);

      if (zctas.length < BATCH_SIZE) break;
    }

    console.log(`Loaded ${totalLoaded} zip codes total`);

    const recordsLinked = await linkMarketsToTiger();
    const relationshipsCreated = await buildHierarchy();

    return {
      level: 'zipcodes',
      recordsLoaded: totalLoaded,
      recordsLinked,
      relationshipsCreated,
      success: true
    };
  } catch (error: any) {
    console.error('Error loading zip codes:', error);
    return {
      level: 'zipcodes',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    };
  }
}
