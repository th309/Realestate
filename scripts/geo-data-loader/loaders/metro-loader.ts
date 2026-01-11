/**
 * Metro (CBSA) Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient, linkMarketsToTiger, buildHierarchy } from '../db-client';

const BATCH_SIZE = 500;

/**
 * Load metros (CBSAs) from TIGER data
 */
export async function loadMetros(): Promise<LoadResult> {
  console.log('\nSTEP 3: Loading Metros (CBSA) from TIGER...');
  const supabase = createSupabaseAdminClient();

  try {
    let offset = 0;
    let totalLoaded = 0;

    while (true) {
      const { data: cbsas, error } = await supabase
        .from('tiger_cbsa')
        .select('geoid, name, geometry, lsad')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('geoid');

      if (error) throw error;
      if (!cbsas || cbsas.length === 0) break;

      const markets = cbsas.map(cbsa => ({
        region_id: `US-MSA-${cbsa.geoid}`,
        region_name: cbsa.name,
        region_type: 'msa',
        geoid: cbsa.geoid,
        geometry: cbsa.geometry,
        external_ids: {
          tiger_cbsa_geoid: cbsa.geoid,
          census_msa: cbsa.geoid
        }
      }));

      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, { onConflict: 'region_id' });

      if (insertError) throw insertError;

      totalLoaded += markets.length;
      offset += BATCH_SIZE;

      console.log(`  Loaded ${totalLoaded} metros...`);

      if (cbsas.length < BATCH_SIZE) break;
    }

    console.log(`Loaded ${totalLoaded} metros total`);

    const recordsLinked = await linkMarketsToTiger();
    const relationshipsCreated = await buildHierarchy();

    return {
      level: 'metros',
      recordsLoaded: totalLoaded,
      recordsLinked,
      relationshipsCreated,
      success: true
    };
  } catch (error: any) {
    console.error('Error loading metros:', error);
    return {
      level: 'metros',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    };
  }
}
