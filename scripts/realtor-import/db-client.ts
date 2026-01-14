/**
 * Database client for Realtor.com Data Import
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
 * Create Supabase client for Realtor import
 */
export function createRealtorImportClient(): SupabaseClient {
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
 * Get table name for a geography level
 */
export function getTableForGeography(geography: string): string {
  const geoLower = geography.toLowerCase();

  switch (geoLower) {
    case 'national':
    case 'country':
      return 'realtor_national';
    case 'state':
      return 'realtor_state';
    case 'metro':
    case 'cbsa':
      return 'realtor_metro';
    case 'county':
      return 'realtor_county';
    case 'zip':
    case 'postal_code':
      return 'realtor_zip';
    default:
      throw new Error(`Unknown geography: ${geography}`);
  }
}
