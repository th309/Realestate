/**
 * Census Import Database Client
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables (root first, then web app overrides if present)
const rootEnvPath = join(__dirname, '../../../.env.local');
const webEnvPath = join(__dirname, '../../../web/.env.local');
config({ path: rootEnvPath });
config({ path: webEnvPath });

let supabaseInstance: SupabaseClient | null = null;

export function getCensusApiKey(): string {
  return process.env.CENSUS_API_KEY || '';
}

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
}

export function createCensusImportClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase credentials');
    process.exit(1);
  }

  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  return supabaseInstance;
}
