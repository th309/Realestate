/**
 * Environment Variable Loader
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Load environment variables from multiple possible locations
 */
export function loadEnvironment(): void {
  const envPaths = [
    path.join(__dirname, '..', '..', 'web', '.env.local'),
    path.join(__dirname, '..', '..', '.env.local'),
    path.join(__dirname, '..', '..', '.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
  }
}

/**
 * Get the Supabase API key from environment
 */
export function getSupabaseKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  );
}

/**
 * Check if using service role key
 */
export function isUsingServiceRoleKey(): boolean {
  return !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
}
