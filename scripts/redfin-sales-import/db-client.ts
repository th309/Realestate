/**
 * Database client utilities for the Redfin sales import pipeline.
 * Handles environment loading, Supabase client creation, connection testing,
 * and batch upsert with retry logic.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RedfinSalesRecord } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

/** Load environment variables from backend .env files */
export function loadEnv(): void {
  const backendDir = path.resolve(__dirname, '../../packages/backend');
  dotenv.config({ path: path.join(backendDir, '.env') });
  dotenv.config({ path: path.join(backendDir, '.env.local') });
  // Also try project-root .env.local (common pattern in this repo)
  dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

/** Create Supabase admin client for script usage */
export function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }

  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(`Invalid Supabase URL format: ${supabaseUrl}`);
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });
}

/** Verify database connectivity before starting the import */
export async function testConnection(supabase: SupabaseClient): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    console.log('  Testing database connection...');
    console.log(`    URL: ${supabaseUrl?.substring(0, 50)}...`);

    const testUrl = `${supabaseUrl}/rest/v1/`;
    const apiKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`  Network test failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log('  Database connection successful!');
    return true;
  } catch (error: any) {
    console.error(`  Connection test failed: ${error.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Upsert conflict columns per table
// ---------------------------------------------------------------------------

export const UPSERT_CONFLICT_COLUMNS: Record<string, string> = {
  redfin_national: 'period_end,property_type',
  redfin_state: 'period_end,state_code,property_type',
  redfin_metro: 'period_end,region_name,property_type',
  redfin_county: 'period_end,county_name,state_code,property_type',
  redfin_city: 'period_end,city_name,state_code,property_type',
  redfin_zip: 'period_end,zip_code,property_type',
  redfin_neighborhood: 'period_end,neighborhood_name,city,state_code,property_type',
};

// ---------------------------------------------------------------------------
// Batch upsert with retry
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1000; // Reduced from 5000 to prevent Supabase resource exhaustion
const MAX_RETRIES = 5;

export { BATCH_SIZE };

// Add a helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function upsertBatch(
  supabase: SupabaseClient,
  tableName: string,
  batch: RedfinSalesRecord[],
  batchNum: number,
  totalBatches: number,
): Promise<{ inserted: number; errors: number }> {
  const conflictColumns = UPSERT_CONFLICT_COLUMNS[tableName];
  if (!conflictColumns) {
    throw new Error(`No conflict columns defined for table ${tableName}`);
  }

  let retries = MAX_RETRIES;
  while (retries > 0) {
    try {
      const { error } = await supabase
        .from(tableName)
        .upsert(batch, {
          onConflict: conflictColumns,
          ignoreDuplicates: true,
        });

      if (error) {
        const isTransient =
          error.message?.includes('fetch') ||
          error.message?.includes('network') ||
          error.message?.includes('ECONNREFUSED');

        if (isTransient && retries > 1) {
          retries--;
          const delay = Math.pow(2, MAX_RETRIES - retries) * 1000;
          console.warn(`    Connection error on batch ${batchNum}, retrying in ${delay}ms... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error(`    Error upserting batch ${batchNum}/${totalBatches} into ${tableName}: ${error.message}`);
        return { inserted: 0, errors: 1 };
      }

      // Log progress periodically
      const totalLabel = totalBatches > 0 ? `/${totalBatches}` : '';
      const streamingMode = totalBatches < 0;
      const logEvery = streamingMode ? 5 : 20;
      if (batchNum === 1 || batchNum % logEvery === 0 || batchNum === totalBatches) {
        console.log(`    Upserted batch ${batchNum}${totalLabel} into ${tableName} (${batch.length} records)`);
      }

      // Add a small delay between batches to allow the Small Supabase instance CPU/RAM to recover
      await delay(200);

      return { inserted: batch.length, errors: 0 };
    } catch (error: any) {
      const isTransient = error.message?.includes('fetch') || error.message?.includes('network');

      if (isTransient && retries > 1) {
        retries--;
        const delay = Math.pow(2, MAX_RETRIES - retries) * 1000;
        console.warn(`    Exception on batch ${batchNum}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error(`    Exception upserting batch ${batchNum}: ${error.message}`);
      return { inserted: 0, errors: 1 };
    }
  }

  return { inserted: 0, errors: 1 };
}
