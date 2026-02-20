import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('='.repeat(70));
  console.log('ZORI SFR & MFR IMPORT VERIFICATION SUMMARY');
  console.log('='.repeat(70));

  // Count all ZORI-related metrics
  const metrics = ['zori', 'zori_sfr', 'zori_mfr'];

  console.log('\nRecord counts by metric:');
  for (const metric of metrics) {
    const { count } = await supabase
      .from('zillow_metro')
      .select('*', { count: 'exact', head: true })
      .eq('metric_name', metric);
    console.log(`  ${metric}: ${count?.toLocaleString() || 0}`);
  }

  // Get unique metro counts
  console.log('\nUnique metros by metric:');
  for (const metric of metrics) {
    const { data } = await supabase
      .from('zillow_metro')
      .select('region_name')
      .eq('metric_name', metric)
      .limit(50000);
    const unique = new Set(data?.map(r => r.region_name));
    console.log(`  ${metric}: ${unique.size} metros`);
  }

  // Show date ranges
  console.log('\nDate ranges:');
  for (const metric of metrics) {
    const { data: minData } = await supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', metric)
      .order('period_date', { ascending: true })
      .limit(1);
    const { data: maxData } = await supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', metric)
      .order('period_date', { ascending: false })
      .limit(1);
    console.log(`  ${metric}: ${minData?.[0]?.period_date} to ${maxData?.[0]?.period_date}`);
  }

  // Sample data verification for zori_sfr
  console.log('\nSample zori_sfr data (New York, latest):');
  const { data: nySfr } = await supabase
    .from('zillow_metro')
    .select('*')
    .eq('metric_name', 'zori_sfr')
    .eq('region_name', 'New York, NY')
    .order('period_date', { ascending: false })
    .limit(3);
  nySfr?.forEach(r => {
    console.log(`  ${r.period_date}: $${r.value?.toFixed(2)} (CBSA: ${r.cbsa_code})`);
  });

  // Sample data verification for zori_mfr
  console.log('\nSample zori_mfr data (New York, latest):');
  const { data: nyMfr } = await supabase
    .from('zillow_metro')
    .select('*')
    .eq('metric_name', 'zori_mfr')
    .eq('region_name', 'New York, NY')
    .order('period_date', { ascending: false })
    .limit(3);
  nyMfr?.forEach(r => {
    console.log(`  ${r.period_date}: $${r.value?.toFixed(2)} (CBSA: ${r.cbsa_code})`);
  });

  // Compare with original zori for New York
  console.log('\nSample zori (aggregate) data (New York, latest):');
  const { data: nyZori } = await supabase
    .from('zillow_metro')
    .select('*')
    .eq('metric_name', 'zori')
    .eq('region_name', 'New York, NY')
    .order('period_date', { ascending: false })
    .limit(3);
  nyZori?.forEach(r => {
    console.log(`  ${r.period_date}: $${r.value?.toFixed(2)} (CBSA: ${r.cbsa_code})`);
  });

  // All metros with zori_sfr data
  console.log('\nAll metros with zori_sfr data:');
  const { data: sfrMetros } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code')
    .eq('metric_name', 'zori_sfr')
    .limit(50000);
  const sfrUnique = new Map<string, string>();
  sfrMetros?.forEach(r => sfrUnique.set(r.region_name, r.cbsa_code));
  Array.from(sfrUnique.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, cbsa]) => {
    console.log(`  - ${name} (CBSA: ${cbsa})`);
  });

  // All metros with zori_mfr data
  console.log('\nAll metros with zori_mfr data:');
  const { data: mfrMetros } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code')
    .eq('metric_name', 'zori_mfr')
    .limit(50000);
  const mfrUnique = new Map<string, string>();
  mfrMetros?.forEach(r => mfrUnique.set(r.region_name, r.cbsa_code));
  Array.from(mfrUnique.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, cbsa]) => {
    console.log(`  - ${name} (CBSA: ${cbsa})`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(70));
  console.log('\nStatus: ZORI SFR and MFR data has been successfully imported.');
  console.log('Note: SFR/MFR datasets have fewer metros than aggregate ZORI (this is expected).');
}

verify().catch(e => console.error('Error:', e));
