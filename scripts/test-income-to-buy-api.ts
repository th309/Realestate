/**
 * Test Income-to-Buy API endpoints
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

async function testIncomeToBuyData() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         TESTING INCOME-TO-BUY DATA ACCESS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const geoTypes = ['national', 'state', 'metro', 'county', 'zip'];

  for (const geoType of geoTypes) {
    // Get latest date
    const { data: latestRow } = await supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geoType)
      .not('income_to_buy', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow) {
      console.log(`${geoType.toUpperCase()}: No data`);
      continue;
    }

    const targetDate = latestRow.period_date;

    // Get count
    const { count } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType)
      .eq('period_date', targetDate)
      .not('income_to_buy', 'is', null);

    // Get sample
    const { data: sample } = await supabase
      .from('calculated_metrics')
      .select('geography_id, geography_name, income_to_buy')
      .eq('geography_type', geoType)
      .eq('period_date', targetDate)
      .not('income_to_buy', 'is', null)
      .order('income_to_buy', { ascending: false })
      .limit(3);

    console.log(`${geoType.toUpperCase().padEnd(10)}: ${count} records (as of ${targetDate})`);
    if (sample && sample.length > 0) {
      for (const row of sample) {
        const income = row.income_to_buy ? `$${row.income_to_buy.toLocaleString()}` : 'N/A';
        console.log(`  - ${row.geography_name}: ${income}/year`);
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('API ENDPOINT FORMAT:');
  console.log('  /api/metrics/income-to-buy/states');
  console.log('  /api/metrics/income-to-buy/metros');
  console.log('  /api/metrics/income-to-buy/counties');
  console.log('  /api/metrics/income-to-buy/zips?state=CA');
  console.log('═══════════════════════════════════════════════════════════════');
}

testIncomeToBuyData().catch(console.error);
