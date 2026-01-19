/**
 * Check income_to_buy data by date
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

async function check() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         INCOME-TO-BUY DATA BY DATE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check what period_dates have income_to_buy data
  const { data, count } = await supabase
    .from('calculated_metrics')
    .select('period_date, geography_type', { count: 'exact' })
    .not('income_to_buy', 'is', null);

  console.log(`Total income_to_buy records: ${count}\n`);

  // Group by date and geography type
  const byDateGeo: Record<string, Record<string, number>> = {};
  for (const row of data || []) {
    if (!byDateGeo[row.period_date]) byDateGeo[row.period_date] = {};
    byDateGeo[row.period_date][row.geography_type] = (byDateGeo[row.period_date][row.geography_type] || 0) + 1;
  }

  const dates = Object.keys(byDateGeo).sort().reverse();
  console.log('Records by period_date:');
  for (const date of dates) {
    const geos = byDateGeo[date];
    const total = Object.values(geos).reduce((a, b) => a + b, 0);
    console.log(`\n  ${date}: ${total} total`);
    for (const [geo, cnt] of Object.entries(geos)) {
      console.log(`    ${geo}: ${cnt}`);
    }
  }

  // Check available historical dates in realtor tables
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('AVAILABLE HISTORICAL REALTOR DATA');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const table of ['realtor_national', 'realtor_state', 'realtor_metro', 'realtor_county']) {
    const { data: dates } = await supabase
      .from(table)
      .select('period_date')
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: false });

    const uniqueDates = [...new Set((dates || []).map((r: any) => r.period_date))];
    console.log(`${table}: ${uniqueDates.length} months of data`);
    console.log(`  Range: ${uniqueDates[uniqueDates.length - 1]} to ${uniqueDates[0]}\n`);
  }
}

check().catch(console.error);
