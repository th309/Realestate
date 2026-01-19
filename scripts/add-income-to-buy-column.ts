/**
 * Add income_to_buy column to calculated_metrics
 *
 * Tries multiple methods to add the column:
 * 1. Supabase RPC exec_sql
 * 2. Direct SQL via pg-promise if DATABASE_URL available
 * 3. Instructions for manual addition
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  console.log('Adding income_to_buy column to calculated_metrics...\n');

  // First check if column already exists
  const { data: sample, error: checkError } = await supabase
    .from('calculated_metrics')
    .select('*')
    .limit(1)
    .single();

  if (sample && 'income_to_buy' in sample) {
    console.log('✅ Column income_to_buy already exists!');
    return true;
  }

  // Try RPC method first
  const sql = `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS income_to_buy DECIMAL(12, 2);`;

  try {
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (!rpcError) {
      console.log('✅ Column added via RPC!');
      return true;
    }
  } catch (e) {
    // RPC not available, continue
  }

  // Try alternative RPC names
  for (const rpcName of ['run_sql', 'execute_sql', 'sql_exec']) {
    try {
      const { error } = await supabase.rpc(rpcName, { query: sql });
      if (!error) {
        console.log(`✅ Column added via ${rpcName}!`);
        return true;
      }
    } catch (e) {
      // Continue
    }
  }

  // If we get here, need manual intervention
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  MANUAL ACTION REQUIRED                                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Please run this SQL in your Supabase SQL Editor:');
  console.log('');
  console.log('  1. Go to: https://supabase.com/dashboard/project/pysflbhpnqwoczyuaaif/sql');
  console.log('  2. Paste and run this SQL:');
  console.log('');
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log('  ALTER TABLE calculated_metrics');
  console.log('  ADD COLUMN IF NOT EXISTS income_to_buy DECIMAL(12, 2);');
  console.log('');
  console.log('  CREATE INDEX IF NOT EXISTS idx_calc_income_to_buy');
  console.log('  ON calculated_metrics(income_to_buy);');
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  3. After running, execute:');
  console.log('     npx tsx scripts/run-refresh-income-to-buy.ts');
  console.log('');

  return false;
}

addColumn().catch(console.error);
