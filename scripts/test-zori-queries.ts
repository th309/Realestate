/**
 * Test ZORI query logic directly against database
 * Verifies that property type filtering works correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

// Replicate the mapRentPropertyType function
function mapRentPropertyType(type: string): string {
  switch (type) {
    case 'sfr': return 'zori_sfr';
    case 'mfr': return 'zori_mfr';
    case 'all':
    default: return 'zori';
  }
}

async function testQuery(propertyType: string, description: string) {
  const metricName = mapRentPropertyType(propertyType);

  console.log(`\n${description}`);
  console.log(`  Property Type: ${propertyType} -> metric_name: ${metricName}`);

  // Query zillow_metro for this metric
  const { data, error, count } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code, period_date, value', { count: 'exact' })
    .eq('metric_name', metricName)
    .order('period_date', { ascending: false })
    .limit(5);

  if (error) {
    console.log(`  ERROR: ${error.message}`);
    return;
  }

  // Get total count
  const { count: totalCount } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', metricName);

  console.log(`  Total Records: ${totalCount?.toLocaleString()}`);
  console.log(`  Sample (latest 5):`);

  data?.forEach(row => {
    console.log(`    - ${row.region_name} (${row.cbsa_code}): $${row.value?.toFixed(2)} [${row.period_date}]`);
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('ZORI QUERY TESTS - Property Type Filtering');
  console.log('='.repeat(70));

  await testQuery('all', 'All Homes (Metro_zori_uc_sfrcondomfr_sm_month)');
  await testQuery('sfr', 'Single Family (Metro_zori_uc_sfr_sm_month)');
  await testQuery('mfr', 'Multi-Family (Metro_zori_uc_mfr_sm_month)');

  // Verify the values are different
  console.log('\n' + '-'.repeat(70));
  console.log('COMPARISON: New York, NY rent values');
  console.log('-'.repeat(70));

  for (const propertyType of ['all', 'sfr', 'mfr']) {
    const metricName = mapRentPropertyType(propertyType);
    const { data } = await supabase
      .from('zillow_metro')
      .select('value, period_date')
      .eq('metric_name', metricName)
      .eq('region_name', 'New York, NY')
      .order('period_date', { ascending: false })
      .limit(1);

    if (data && data[0]) {
      console.log(`  ${propertyType.toUpperCase().padEnd(5)}: $${data[0].value?.toFixed(2)} (${data[0].period_date})`);
    } else {
      console.log(`  ${propertyType.toUpperCase().padEnd(5)}: NO DATA`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
