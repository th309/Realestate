/**
 * Zillow US/Metro Import Database Client
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: join(__dirname, '../../web/.env.local') });

let supabaseInstance: SupabaseClient | null = null;

export function createZillowUsMetroClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseInstance;
}

export function getBuildZillowUrl(): any {
  try {
    const zillowDatasets = require('../../web/lib/data-ingestion/sources/zillow-datasets');
    return zillowDatasets.buildZillowUrl;
  } catch (error) {
    console.error('❌ Could not import zillow-datasets');
    process.exit(1);
  }
}
