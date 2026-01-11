/**
 * State Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient, linkMarketsToTiger, buildHierarchy } from '../db-client';

/**
 * Load states from TIGER data
 */
export async function loadStates(): Promise<LoadResult> {
  console.log('\nSTEP 2: Loading States from TIGER...');
  const supabase = createSupabaseAdminClient();

  try {
    const { data: statesData, error: directError } = await supabase
      .from('tiger_states')
      .select('geoid, name, geometry')
      .order('geoid');

    if (directError) throw directError;

    const markets = statesData?.map(state => ({
      region_id: `US-${state.geoid}`,
      region_name: state.name,
      region_type: 'state',
      state_code: state.geoid,
      state_name: state.name,
      geoid: state.geoid,
      geometry: state.geometry,
      external_ids: {
        tiger_state_geoid: state.geoid
      }
    })) || [];

    if (markets.length > 0) {
      const { error: insertError } = await supabase
        .from('markets')
        .upsert(markets, { onConflict: 'region_id' });

      if (insertError) throw insertError;
    }

    console.log(`Loaded ${markets.length} states`);

    const recordsLinked = await linkMarketsToTiger();
    const relationshipsCreated = await buildHierarchy();

    return {
      level: 'states',
      recordsLoaded: markets.length,
      recordsLinked,
      relationshipsCreated,
      success: true
    };
  } catch (error: any) {
    console.error('Error loading states:', error);
    return {
      level: 'states',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    };
  }
}
