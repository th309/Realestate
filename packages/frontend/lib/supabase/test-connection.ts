/**
 * Test database connection
 * Run this to verify Supabase is configured correctly
 */

import { createSupabaseServerClient } from './server'

export async function testDatabaseConnection() {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Test 1: Check if we can query tier_configs (should have 4 rows)
    const { data: tiers, error: tiersError } = await supabase
      .from('tier_configs')
      .select('tier_name, price')
      .limit(10)
    
    if (tiersError) {
      return {
        success: false,
        error: `Failed to query tier_configs: ${tiersError.message}`
      }
    }
    
    // Test 2: Check markets table exists (should be empty initially)
    const { data: geoData, error: geoError } = await supabase
      .from('markets')
      .select('region_id')
      .limit(1)
    
    if (geoError) {
      return {
        success: false,
        error: `Failed to query markets: ${geoError.message}`
      }
    }
    
    return {
      success: true,
      message: 'Database connection successful!',
      details: {
        tierConfigsFound: tiers?.length || 0,
        geoDataCount: geoData?.length || 0
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Connection failed: ${error.message}`
    }
  }
}

