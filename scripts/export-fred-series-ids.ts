/**
 * Export FRED Series IDs
 * 
 * Exports current FRED series IDs from normalization tables to CSV for review.
 * 
 * Usage:
 *   npx tsx scripts/export-fred-series-ids.ts --geography=state
 *   npx tsx scripts/export-fred-series-ids.ts --geography=state --output=state-fred-ids.csv
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { writeFileSync } from 'fs';

config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function exportStateSeriesIds(outputFile: string) {
  const { data, error } = await supabase
    .from('tiger_states')
    .select('geoid, name, state_abbreviation, fred_unemployment_rate_series_id, fred_employment_total_series_id, fred_median_household_income_series_id, fred_gdp_series_id, fred_housing_permits_series_id')
    .order('name');

  if (error) {
    console.error(`❌ Error fetching states: ${error.message}`);
    process.exit(1);
  }

  // Create CSV
  const headers = ['geoid', 'name', 'state_abbreviation', 'unemployment_rate', 'employment_total', 'median_household_income', 'gdp', 'housing_permits'];
  const rows = [headers.join(',')];

  for (const state of data || []) {
    const row = [
      state.geoid,
      `"${state.name}"`,
      state.state_abbreviation || '',
      state.fred_unemployment_rate_series_id || '',
      state.fred_employment_total_series_id || '',
      state.fred_median_household_income_series_id || '',
      state.fred_gdp_series_id || '',
      state.fred_housing_permits_series_id || ''
    ];
    rows.push(row.join(','));
  }

  const csv = rows.join('\n');
  writeFileSync(outputFile, csv, 'utf-8');

  console.log(`✅ Exported ${data?.length || 0} states to ${outputFile}`);
  
  // Summary
  const withUnemployment = data?.filter(s => s.fred_unemployment_rate_series_id).length || 0;
  const withEmployment = data?.filter(s => s.fred_employment_total_series_id).length || 0;
  const withIncome = data?.filter(s => s.fred_median_household_income_income_series_id).length || 0;
  const withGdp = data?.filter(s => s.fred_gdp_series_id).length || 0;
  const withPermits = data?.filter(s => s.fred_housing_permits_series_id).length || 0;

  console.log('\n📊 Summary:');
  console.log(`   Unemployment Rate: ${withUnemployment}/${data?.length || 0}`);
  console.log(`   Employment Total: ${withEmployment}/${data?.length || 0}`);
  console.log(`   Median Household Income: ${withIncome}/${data?.length || 0}`);
  console.log(`   GDP: ${withGdp}/${data?.length || 0}`);
  console.log(`   Housing Permits: ${withPermits}/${data?.length || 0}`);
}

async function main() {
  const args = process.argv.slice(2);
  const geography = args.find(arg => arg.startsWith('--geography='))?.split('=')[1] || 'state';
  const output = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || `fred-series-ids-${geography}.csv`;

  if (geography === 'state') {
    await exportStateSeriesIds(output);
  } else {
    console.error(`❌ Geography ${geography} not yet supported`);
    process.exit(1);
  }
}

main().catch(console.error);

