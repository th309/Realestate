/**
 * Debug script to investigate Zillow data mapping for backtesting
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Backtest Data Mapping Debug ===\n');

  // 1. Check state geography IDs in history
  console.log('1. Sample STATE geography_ids in propertyiq_scores_history:');
  const { data: stateHistory } = await supabase
    .from('propertyiq_scores_history')
    .select('geography_id')
    .eq('geography_type', 'state')
    .limit(10);
  console.log('   ', stateHistory?.map(s => s.geography_id).join(', '));

  // 2. Check zillow_state structure
  console.log('\n2. Sample zillow_state records:');
  const { data: zillowState } = await supabase
    .from('zillow_state')
    .select('state_code, metric_name, period_date, value')
    .eq('metric_name', 'zhvi')
    .limit(5);
  console.log('   ', zillowState);

  // 3. Check metro geography IDs
  console.log('\n3. Sample METRO geography_ids in propertyiq_scores_history:');
  const { data: metroHistory } = await supabase
    .from('propertyiq_scores_history')
    .select('geography_id')
    .eq('geography_type', 'metro')
    .limit(10);
  console.log('   ', metroHistory?.map(s => s.geography_id).join(', '));

  // 4. Check zillow_metro structure
  console.log('\n4. Sample zillow_metro records (cbsa_code):');
  const { data: zillowMetro } = await supabase
    .from('zillow_metro')
    .select('cbsa_code, region_name, metric_name, period_date, value')
    .eq('metric_name', 'zhvi')
    .not('cbsa_code', 'is', null)
    .limit(5);
  console.log('   ', zillowMetro);

  // 5. Check if we have ZHVI data at all
  console.log('\n5. ZHVI record counts by table:');
  for (const table of ['zillow_state', 'zillow_metro', 'zillow_county', 'zillow_zip']) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', 'zhvi');
    console.log(`   ${table}: ${count?.toLocaleString() || 0} ZHVI records`);
  }

  // 6. Check county mapping
  console.log('\n6. Sample COUNTY geography_ids in propertyiq_scores_history:');
  const { data: countyHistory } = await supabase
    .from('propertyiq_scores_history')
    .select('geography_id')
    .eq('geography_type', 'county')
    .limit(10);
  console.log('   ', countyHistory?.map(s => s.geography_id).join(', '));

  console.log('\n7. Sample zillow_county records (fips_code):');
  const { data: zillowCounty } = await supabase
    .from('zillow_county')
    .select('fips_code, region_name, metric_name, period_date, value')
    .eq('metric_name', 'zhvi')
    .not('fips_code', 'is', null)
    .limit(5);
  console.log('   ', zillowCounty);

  // 8. Check ZIP mapping
  console.log('\n8. Sample ZIP geography_ids in propertyiq_scores_history:');
  const { data: zipHistory } = await supabase
    .from('propertyiq_scores_history')
    .select('geography_id')
    .eq('geography_type', 'zip')
    .limit(10);
  console.log('   ', zipHistory?.map(s => s.geography_id).join(', '));

  console.log('\n9. Sample zillow_zip records (region_name):');
  const { data: zillowZip } = await supabase
    .from('zillow_zip')
    .select('region_name, metric_name, period_date, value')
    .eq('metric_name', 'zhvi')
    .limit(5);
  console.log('   ', zillowZip);

  // 10. Try a specific join test
  console.log('\n10. Test ZHVI lookup for a specific metro:');
  if (metroHistory && metroHistory[0]) {
    const testMetro = metroHistory[0].geography_id;
    console.log(`    Testing metro: ${testMetro}`);

    const { data: zhviData, error } = await supabase
      .from('zillow_metro')
      .select('cbsa_code, period_date, value')
      .eq('cbsa_code', testMetro)
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(5);

    if (error) {
      console.log(`    Error: ${error.message}`);
    } else {
      console.log(`    Found ${zhviData?.length || 0} ZHVI records`);
      console.log('    ', zhviData);
    }
  }
}

main().catch(console.error);
