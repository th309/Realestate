/**
 * Quick test of backtest population logic
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ZILLOW_CONFIGS: Record<string, { table: string; idColumn: string }> = {
  state: { table: 'zillow_state', idColumn: 'state_code' },
  metro: { table: 'zillow_metro', idColumn: 'cbsa_code' },
  county: { table: 'zillow_county', idColumn: 'fips_code' },
  zip: { table: 'zillow_zip', idColumn: 'region_name' },
};

function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

async function getZHVI(geoType: string, geoId: string, targetDate: string): Promise<number | null> {
  const config = ZILLOW_CONFIGS[geoType];
  if (!config) return null;

  const targetYear = targetDate.substring(0, 4);
  const targetMonth = targetDate.substring(5, 7);
  const monthStart = `${targetYear}-${targetMonth}-01`;
  const monthEnd = `${targetYear}-${targetMonth}-31`;

  const { data } = await supabase
    .from(config.table)
    .select('value, period_date')
    .eq(config.idColumn, geoId)
    .eq('metric_name', 'zhvi')
    .gte('period_date', monthStart)
    .lte('period_date', monthEnd)
    .limit(1);

  if (data && data[0]?.value) {
    console.log(`  Found ZHVI for ${geoType}/${geoId} at ${data[0].period_date}: $${Math.round(data[0].value).toLocaleString()}`);
    return data[0].value;
  }

  return null;
}

async function main() {
  console.log('=== Test Backtest Population ===\n');

  // Test a few specific cases
  const testCases = [
    { geoType: 'state', geoId: 'CA', scoreDate: '2020-01-01' },
    { geoType: 'metro', geoId: '12420', scoreDate: '2020-01-01' },  // Austin
    { geoType: 'county', geoId: '06037', scoreDate: '2020-01-01' }, // LA County
    { geoType: 'zip', geoId: '90210', scoreDate: '2020-01-01' },    // Beverly Hills
  ];

  for (const test of testCases) {
    console.log(`\nTesting ${test.geoType}: ${test.geoId} from ${test.scoreDate}`);
    console.log('─'.repeat(50));

    // Get starting ZHVI
    const startZHVI = await getZHVI(test.geoType, test.geoId, test.scoreDate);
    if (!startZHVI) {
      console.log('  ❌ No starting ZHVI found');
      continue;
    }

    // Get 12m future ZHVI
    const future12m = addMonths(test.scoreDate, 12);
    const zhvi12m = await getZHVI(test.geoType, test.geoId, future12m);

    // Get 36m future ZHVI
    const future36m = addMonths(test.scoreDate, 36);
    const zhvi36m = await getZHVI(test.geoType, test.geoId, future36m);

    // Get 60m future ZHVI
    const future60m = addMonths(test.scoreDate, 60);
    const zhvi60m = await getZHVI(test.geoType, test.geoId, future60m);

    // Calculate appreciation
    if (zhvi12m) {
      const appr12m = (zhvi12m - startZHVI) / startZHVI;
      console.log(`  1yr appreciation: ${(appr12m * 100).toFixed(1)}%`);
    }
    if (zhvi36m) {
      const appr36m = (zhvi36m - startZHVI) / startZHVI;
      console.log(`  3yr appreciation: ${(appr36m * 100).toFixed(1)}%`);
    }
    if (zhvi60m) {
      const appr60m = (zhvi60m - startZHVI) / startZHVI;
      console.log(`  5yr appreciation: ${(appr60m * 100).toFixed(1)}%`);
    }
  }

  console.log('\n✓ Test complete');
}

main().catch(console.error);
