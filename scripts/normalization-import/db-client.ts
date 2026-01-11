/**
 * Database client and batch operations for Normalization CSV Import
 */

import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { escapeSQL } from './helpers';

// Load environment variables
config({ path: join(__dirname, '../../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * Create Supabase client for normalization import
 */
export function createNormalizationClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
    console.error('   Required: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
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
 * Get Supabase URL for logging
 */
export function getSupabaseUrl(): string {
  return supabaseUrl || '';
}

const BATCH_SIZE = 1000;

/**
 * Batch insert with upsert using exec_sql RPC
 */
export async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  records: any[],
  conflictColumn: string,
  batchSize: number = BATCH_SIZE
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    try {
      // Build SQL INSERT with ON CONFLICT
      const columns = Object.keys(batch[0]);
      const values = batch.map(record => {
        const vals = columns.map(col => escapeSQL(record[col]));
        return `(${vals.join(', ')})`;
      });

      // Handle conflict column (can be single or composite)
      const conflictCols = conflictColumn.split(',').map(c => c.trim());
      const conflictClause = conflictCols.length > 1
        ? conflictCols.join(', ')
        : conflictColumn;

      // Build UPDATE clause for ON CONFLICT
      const updateColumns = columns.filter(col => !conflictCols.includes(col));
      const updateClause = updateColumns.length > 0
        ? `DO UPDATE SET ${updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`
        : 'DO NOTHING';

      const sql = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${values.join(', ')}
        ON CONFLICT (${conflictClause}) ${updateClause}
      `;

      // Execute via exec_sql RPC
      const { error } = await supabase.rpc('exec_sql', { query: sql });

      if (error) {
        errors.push(`Batch ${batchNum}: ${error.message}`);
        console.error(`   ❌ Error inserting batch ${batchNum}: ${error.message}`);
      } else {
        inserted += batch.length;
        if (batchNum % 10 === 0) {
          console.log(`   ✅ Inserted ${inserted.toLocaleString()} records...`);
        }
      }
    } catch (err: any) {
      errors.push(`Batch ${batchNum}: ${err.message}`);
      console.error(`   ❌ Exception in batch ${batchNum}: ${err.message}`);
    }
  }

  return { inserted, errors };
}
