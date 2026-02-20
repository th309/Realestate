import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('='.repeat(60));
  console.log('ZORI SFR & MFR DATA VERIFICATION');
  console.log('='.repeat(60));

  // 1. Count ZORI SFR records
  const { count: sfrCount, error: sfrError } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'zori_sfr');

  console.log('\n1. ZORI SFR (Single Family Rentals):');
  console.log('   Records:', sfrError ? 'Error: ' + sfrError.message : sfrCount?.toLocaleString());

  // 2. Count ZORI MFR records
  const { count: mfrCount, error: mfrError } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'zori_mfr');

  console.log('\n2. ZORI MFR (Multifamily Rentals):');
  console.log('   Records:', mfrError ? 'Error: ' + mfrError.message : mfrCount?.toLocaleString());

  // 3. Get distinct metros for SFR
  const { data: sfrMetros } = await supabase
    .from('zillow_metro')
    .select('region_name')
    .eq('metric_name', 'zori_sfr');

  const uniqueSfrMetros = new Set(sfrMetros?.map(r => r.region_name));
  console.log('\n3. Unique metros with SFR data:', uniqueSfrMetros.size);

  // 4. Get distinct metros for MFR
  const { data: mfrMetros } = await supabase
    .from('zillow_metro')
    .select('region_name')
    .eq('metric_name', 'zori_mfr');

  const uniqueMfrMetros = new Set(mfrMetros?.map(r => r.region_name));
  console.log('   Unique metros with MFR data:', uniqueMfrMetros.size);

  // 5. Get date range for SFR
  const { data: sfrDatesMin } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori_sfr')
    .order('period_date', { ascending: true })
    .limit(1);

  const { data: sfrDatesMax } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori_sfr')
    .order('period_date', { ascending: false })
    .limit(1);

  console.log('\n4. ZORI SFR Date Range:');
  console.log('   From:', sfrDatesMin?.[0]?.period_date || 'N/A');
  console.log('   To:', sfrDatesMax?.[0]?.period_date || 'N/A');

  // 6. Get date range for MFR
  const { data: mfrDatesMin } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori_mfr')
    .order('period_date', { ascending: true })
    .limit(1);

  const { data: mfrDatesMax } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori_mfr')
    .order('period_date', { ascending: false })
    .limit(1);

  console.log('\n5. ZORI MFR Date Range:');
  console.log('   From:', mfrDatesMin?.[0]?.period_date || 'N/A');
  console.log('   To:', mfrDatesMax?.[0]?.period_date || 'N/A');

  // 7. Sample data for SFR
  const { data: sfrSample } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code, period_date, value')
    .eq('metric_name', 'zori_sfr')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\n6. Sample ZORI SFR data (latest):');
  sfrSample?.forEach(r => {
    console.log(`   ${r.region_name} | ${r.cbsa_code} | ${r.period_date} | $${r.value?.toFixed(2)}`);
  });

  // 8. Sample data for MFR
  const { data: mfrSample } = await supabase
    .from('zillow_metro')
    .select('region_name, cbsa_code, period_date, value')
    .eq('metric_name', 'zori_mfr')
    .order('period_date', { ascending: false })
    .limit(5);

  console.log('\n7. Sample ZORI MFR data (latest):');
  mfrSample?.forEach(r => {
    console.log(`   ${r.region_name} | ${r.cbsa_code} | ${r.period_date} | $${r.value?.toFixed(2)}`);
  });

  // 9. Check all metric names using RPC
  const { data: metricsResult, error: metricsError } = await supabase.rpc('exec_sql', {
    sql: `SELECT metric_name, COUNT(*)::text as cnt FROM zillow_metro GROUP BY metric_name ORDER BY metric_name`
  });

  console.log('\n8. All metric names in zillow_metro (via SQL):');
  if (metricsError) {
    console.log('   Error:', metricsError.message);
    // Fallback - just get some records
    const { data: sample } = await supabase
      .from('zillow_metro')
      .select('metric_name')
      .limit(1000);
    const unique = new Set(sample?.map(r => r.metric_name));
    console.log('   Sample-based metrics:');
    Array.from(unique).sort().forEach(m => console.log(`   - ${m}`));
  } else {
    console.log(metricsResult);
  }

  // Total count
  const { count: totalCount } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true });
  console.log('\n9. Total records in zillow_metro:', totalCount?.toLocaleString());

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));
}

verify().catch(e => console.error('Error:', e));
