/**
 * Run Migration 043: Add calculated metric columns - Direct execution
 */
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../packages/frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const statements = [
  // Add columns
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS cap_rate DECIMAL(10, 4)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS gross_yield DECIMAL(10, 4)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS rent_to_price_ratio DECIMAL(10, 6)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS market_health_score DECIMAL(5, 2)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS investment_score DECIMAL(5, 2)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS long_term_growth_score DECIMAL(5, 2)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS home_value_5yr_cagr DECIMAL(8, 4)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS inventory_surplus_pct DECIMAL(8, 4)`,
  `ALTER TABLE calculated_metrics ADD COLUMN IF NOT EXISTS overvalued_pct DECIMAL(8, 4)`,
  // Add indexes
  `CREATE INDEX IF NOT EXISTS idx_calc_cap_rate ON calculated_metrics(cap_rate)`,
  `CREATE INDEX IF NOT EXISTS idx_calc_market_health ON calculated_metrics(market_health_score)`,
  `CREATE INDEX IF NOT EXISTS idx_calc_investment ON calculated_metrics(investment_score)`,
  `CREATE INDEX IF NOT EXISTS idx_calc_growth ON calculated_metrics(long_term_growth_score)`,
];

async function main() {
  console.log('🚀 Running Migration 043: Add calculated metric columns');
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 70).replace(/\n/g, ' ').replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { query: stmt });

    if (error) {
      console.log(`   ❌ ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Success`);
      success++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Migration 043: ${success} succeeded, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
  } else {
    console.log('⚠️  SOME STATEMENTS FAILED');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
