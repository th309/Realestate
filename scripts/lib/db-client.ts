/**
 * Singleton Supabase client factory for data import scripts.
 *
 * Loads environment variables from multiple locations (root, frontend, backend)
 * and creates a single shared Supabase admin client with service role credentials.
 * Crashes immediately if required credentials are missing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load env files from all possible locations (first match wins per variable)
const projectRoot = join(__dirname, '../..');
config({ path: join(projectRoot, '.env.local') });
config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, 'packages/frontend/.env.local') });
config({ path: join(projectRoot, 'packages/backend/.env') });

/** Cached singleton client instance. */
let cachedClient: SupabaseClient | null = null;

/**
 * Returns a shared Supabase admin client (singleton).
 * Exits with code 1 if required environment variables are missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    console.error('FATAL: Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.');
    process.exit(1);
  }

  if (!supabaseServiceKey) {
    console.error('FATAL: Missing Supabase service key. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY.');
    process.exit(1);
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });

  return cachedClient;
}

/**
 * Returns the backend API URL for status reporting.
 * Returns null if BACKEND_API_URL is not set (non-fatal for scripts).
 */
export function getBackendApiUrl(): string | null {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || null;
}
