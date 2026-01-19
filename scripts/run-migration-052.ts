/**
 * Run Migration 052: Add years_to_save column to calculated_metrics
 *
 * This migration adds the years_to_save column to the calculated_metrics table.
 * Formula: (Median listing price × 0.20) / (Median Income × 0.10)
 *
 * Usage: npx ts-node scripts/run-migration-052.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running Migration 052: Add years_to_save column...\n');

  const sqlPath = path.join(process.cwd(), 'scripts/migrations/052-add-years-to-save-column.sql');

  // First, verify if column already exists by attempting a select
  console.log('Checking if years_to_save column exists...');
  const { error: selectError } = await supabase
    .from('calculated_metrics')
    .select('years_to_save')
    .limit(1);

  if (!selectError) {
    console.log('✅ years_to_save column already exists!\n');
    return;
  }

  if (selectError && !selectError.message.includes('years_to_save')) {
    console.log('✅ years_to_save column already exists!\n');
    return;
  }

  console.log('Column does not exist. Please run migration manually:\n');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Run the following SQL:\n');
  console.log('------------------------------------');
  console.log(`ALTER TABLE calculated_metrics
ADD COLUMN IF NOT EXISTS years_to_save DECIMAL(5,1);

COMMENT ON COLUMN calculated_metrics.years_to_save IS 'Years to save for 20% down payment at 10% savings rate';`);
  console.log('------------------------------------\n');
  console.log(`Or copy contents from: ${sqlPath}\n`);
}

runMigration().catch(console.error);
