/**
 * Database client for Census and Economic Data Import
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from multiple possible locations
config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../packages/frontend/.env.local') });
config({ path: join(__dirname, '../../packages/backend/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * Create Supabase client for Census/Economic import
 */
export function createImportClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Get census table name for a geography level
 */
export function getCensusTableForGeography(geography: string): string {
  const geoLower = geography.toLowerCase();

  switch (geoLower) {
    case 'national':
    case 'us':
      return 'census_national';
    case 'state':
      return 'census_state';
    case 'metro':
    case 'cbsa':
      return 'census_metro';
    case 'county':
      return 'census_county';
    case 'city':
    case 'place':
      return 'census_city';
    case 'zip':
    case 'zcta':
      return 'census_zip';
    default:
      throw new Error(`Unknown geography: ${geography}`);
  }
}

/**
 * Get economic table name for a geography level
 */
export function getEconomicTableForGeography(geography: string): string {
  const geoLower = geography.toLowerCase();

  switch (geoLower) {
    case 'national':
    case 'us':
      return 'economic_national';
    case 'state':
      return 'economic_state';
    case 'metro':
    case 'cbsa':
      return 'economic_metro';
    case 'county':
      return 'economic_county';
    default:
      throw new Error(`Unknown geography: ${geography}`);
  }
}
