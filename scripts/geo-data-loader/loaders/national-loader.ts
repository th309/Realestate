/**
 * National Market Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient } from '../db-client';

/**
 * Load national market record with geometry from tiger_national
 */
export async function loadNational(): Promise<LoadResult> {
  console.log('\nSTEP 1: Loading National...');
  const supabase = createSupabaseAdminClient();

  try {
    // First, try to get geometry from tiger_national table
    const { data: nationalData, error: geoError } = await supabase
      .from('tiger_national')
      .select('geoid, name, geometry')
      .limit(1)
      .single();

    if (geoError && geoError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is ok if table doesn't exist yet
      console.warn('Warning: Could not fetch tiger_national geometry:', geoError.message);
    }

    const marketRecord: any = {
      region_id: 'US',
      region_name: 'United States',
      region_type: 'national',
      created_at: new Date().toISOString()
    };

    // Add geometry if available from tiger_national
    if (nationalData?.geometry) {
      marketRecord.geometry = nationalData.geometry;
      marketRecord.external_ids = {
        tiger_national_geoid: nationalData.geoid || 'US'
      };
      console.log('  Including geometry from tiger_national');
    }

    const { error } = await supabase
      .from('markets')
      .upsert(marketRecord, {
        onConflict: 'region_id'
      });

    if (error) throw error;

    console.log('National loaded: US');
    return {
      level: 'national',
      recordsLoaded: 1,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: true
    };
  } catch (error: any) {
    console.error('Error loading national:', error);
    return {
      level: 'national',
      recordsLoaded: 0,
      recordsLinked: 0,
      relationshipsCreated: 0,
      success: false,
      error: error.message
    };
  }
}
