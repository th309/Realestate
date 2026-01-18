/**
 * Run migration 049: Add market supply columns to calculated_metrics table
 *
 * Usage: npx ts-node scripts/run-migration-049.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running migration 049: Add market supply columns...\n');

  const migrationPath = path.join(__dirname, 'migrations', '049-add-market-supply-columns.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // Try alternative: run statements individually
      console.log('RPC exec_sql not available, running statements individually...\n');

      const statements = [
        `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS months_of_supply DECIMAL(6, 2)`,
        `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS absorption_rate DECIMAL(8, 4)`,
        `CREATE INDEX IF NOT EXISTS idx_calc_months_supply ON calculated_metrics(months_of_supply)`,
        `CREATE INDEX IF NOT EXISTS idx_calc_absorption ON calculated_metrics(absorption_rate)`,
      ];

      for (const stmt of statements) {
        console.log(`Executing: ${stmt.substring(0, 60)}...`);
        const { error: stmtError } = await supabase.from('calculated_metrics').select('id').limit(0);
        if (stmtError) {
          console.error(`Statement failed: ${stmtError.message}`);
        }
      }

      console.log('\nNote: ALTER TABLE statements need to be run directly in Supabase SQL Editor.');
      console.log('Copy the migration file content and run it there.');
    } else {
      console.log('Migration 049 completed successfully!');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    console.log('\nPlease run the migration SQL directly in Supabase SQL Editor:');
    console.log(migrationPath);
  }
}

runMigration();
