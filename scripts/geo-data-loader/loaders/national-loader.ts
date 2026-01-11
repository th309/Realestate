/**
 * National Market Loader
 */

import type { LoadResult } from '../types';
import { createSupabaseAdminClient } from '../db-client';

/**
 * Load national market record
 */
export async function loadNational(): Promise<LoadResult> {
  console.log('\nSTEP 1: Loading National...');
  const supabase = createSupabaseAdminClient();

  try {
    const { error } = await supabase
      .from('markets')
      .upsert({
        region_id: 'US',
        region_name: 'United States',
        region_type: 'national',
        created_at: new Date().toISOString()
      }, {
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
