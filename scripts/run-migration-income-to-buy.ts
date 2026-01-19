/**
 * Run Migration: Add income_to_buy column to calculated_metrics
 *
 * Adds the income_to_buy column for "Income Needed to Buy" proxy calculation
 * Uses Realtor price data across all geography levels
 *
 * Usage: npx tsx scripts/run-migration-income-to-buy.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Try multiple env locations
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Checked: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running Migration: Add income_to_buy column...\n');

  // Check if column already exists
  const { data: existing, error: checkError } = await supabase
    .from('calculated_metrics')
    .select('income_to_buy')
    .limit(1);

  if (!checkError) {
    console.log('Column income_to_buy already exists in calculated_metrics table.');
    console.log('Migration already applied - skipping.\n');
    return;
  }

  // Column doesn't exist, try to add it
  console.log('Adding income_to_buy column...');

  // Use direct SQL via RPC if available
  const sql = `
    ALTER TABLE calculated_metrics
    ADD COLUMN IF NOT EXISTS income_to_buy DECIMAL(12, 2);

    CREATE INDEX IF NOT EXISTS idx_calc_income_to_buy ON calculated_metrics(income_to_buy);

    COMMENT ON COLUMN calculated_metrics.income_to_buy IS 'Annual income needed to buy: (PITI × 12) / 0.28. Assumes 20% down, 30-yr fixed at FRED rate, 1.1% tax, 0.35% insurance.';
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.log('\nRPC exec_sql not available.');
      console.log('Please run the following SQL directly in Supabase SQL Editor:\n');
      console.log('------- SQL START -------');
      console.log(sql);
      console.log('------- SQL END -------\n');
      console.log('Or run the migration file: scripts/migrations/051-add-income-to-buy-column.sql\n');
    } else {
      console.log('Migration completed successfully!');
    }
  } catch (err) {
    console.error('Migration execution error:', err);
    console.log('\nPlease run the SQL manually in Supabase SQL Editor.');
  }

  // Verify result
  const { error: verifyError } = await supabase
    .from('calculated_metrics')
    .select('income_to_buy')
    .limit(1);

  if (!verifyError) {
    console.log('\n✅ Column income_to_buy is now accessible!');
  } else {
    console.log('\n❌ Column verification failed. Please run migration manually.');
    console.log(`   Error: ${verifyError.message}`);
  }
}

runMigration().catch(console.error);
