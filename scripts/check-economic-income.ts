/**
 * Check economic tables for income data
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking economic tables for income data...\n');

  // Check economic tables: metro, state, county, national
  const tables = [
    'economic_metro',
    'economic_state',
    'economic_county',
    'economic_national'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`${table}: Error - ${error.message}`);
        continue;
      }

      console.log(`${table}: ${count} records`);

      // Get sample columns
      const { data: sample } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (sample && sample.length > 0) {
        const cols = Object.keys(sample[0]);
        const incomeCols = cols.filter(c => c.toLowerCase().includes('income'));
        console.log(`  Income columns: ${incomeCols.length > 0 ? incomeCols.join(', ') : 'none'}`);
        console.log(`  All columns: ${cols.slice(0, 10).join(', ')}${cols.length > 10 ? '...' : ''}`);
      }
    } catch (err: any) {
      console.log(`${table}: Not found or error`);
    }
  }

  // Also check BEA per_capita_income in economic_metro
  console.log('\nChecking for per_capita_income in economic_metro...');
  const { data: incomeData, count: incomeCount } = await supabase
    .from('economic_metro')
    .select('cbsa_code, cbsa_title, per_capita_income')
    .not('per_capita_income', 'is', null)
    .limit(10);

  console.log(`Records with per_capita_income: ${incomeCount}`);
  if (incomeData && incomeData.length > 0) {
    console.log('Sample:');
    for (const row of incomeData.slice(0, 5)) {
      console.log(`  ${row.cbsa_title}: $${row.per_capita_income?.toLocaleString()}`);
    }
  }
}

check().catch(console.error);
