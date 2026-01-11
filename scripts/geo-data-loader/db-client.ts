/**
 * Database Client for Geographic Data Loader
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../web/.env.local') });

let supabaseClient: SupabaseClient | null = null;

/**
 * Create Supabase admin client
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Check your .env.local file.');
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });

  return supabaseClient;
}

/**
 * Link markets to TIGER data
 */
export async function linkMarketsToTiger(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('link_markets_to_tiger');

  if (error) {
    console.warn('Warning linking to TIGER:', error.message);
    return 0;
  }

  console.log('Linked markets to TIGER');
  return data || 0;
}

/**
 * Build market hierarchy from TIGER data
 */
export async function buildHierarchy(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('build_markets_hierarchy_from_tiger');

  if (error) {
    console.warn('Warning building hierarchy:', error.message);
    return 0;
  }

  console.log('Created hierarchy relationships');
  return data?.[0]?.relationships_created || data || 0;
}

/**
 * Run final complete hierarchy build
 */
export async function buildCompleteHierarchy(): Promise<void> {
  console.log('Running final hierarchy build...');
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('build_markets_hierarchy_complete');

  if (error) {
    console.warn('Warning in final hierarchy build:', error.message);
  } else {
    console.log('Final hierarchy build complete\n');
  }
}
