import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function check() {
  console.log('='.repeat(70));
  console.log('ZORI METRIC MAPPING VERIFICATION');
  console.log('='.repeat(70));

  console.log('\nExpected mapping:');
  console.log('  CSV File                              -> metric_name -> Property Type');
  console.log('  Metro_zori_uc_sfrcondomfr_sm_month   -> zori        -> All Homes');
  console.log('  Metro_zori_uc_sfr_sm_month           -> zori_sfr    -> Single Family');
  console.log('  Metro_zori_uc_mfr_sm_month           -> zori_mfr    -> Multi-Family');

  const metrics = ['zori', 'zori_sfr', 'zori_mfr'];
  const labels = ['All Homes', 'Single Family', 'Multi-Family'];

  console.log('\n' + '-'.repeat(70));
  console.log('Current data in zillow_metro:');
  console.log('-'.repeat(70));

  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const label = labels[i];

    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metric);

    // Get unique metros count
    const { data: metroData } = await supabase
      .from('zillow_metro')
      .select('region_name')
      .eq('metric_name', metric)
      .limit(50000);

    const uniqueMetros = new Set(metroData?.map(r => r.region_name)).size;

    // Get sample for New York
    const { data: sample } = await supabase
      .from('zillow_metro')
      .select('region_name, value, period_date')
      .eq('metric_name', metric)
      .eq('region_name', 'New York, NY')
      .order('period_date', { ascending: false })
      .limit(1);

    console.log(`\n${metric} (${label}):`);
    console.log(`  Records: ${count?.toLocaleString() || 0}`);
    console.log(`  Unique metros: ${uniqueMetros}`);
    if (sample && sample[0]) {
      console.log(`  Sample (New York, NY): $${sample[0].value?.toFixed(2)} (${sample[0].period_date})`);
    } else {
      console.log(`  Sample: NO DATA`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

check().catch(e => console.error('Error:', e));
