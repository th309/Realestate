import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

async function verify() {
  console.log('='.repeat(70));
  console.log('ZORI SFR & MFR VERIFICATION');
  console.log('='.repeat(70));

  // Get counts
  const { count: sfrCount } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'zori_sfr');

  const { count: mfrCount } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .eq('metric_name', 'zori_mfr');

  console.log('\nRecord counts:');
  console.log(`  zori_sfr: ${sfrCount?.toLocaleString()}`);
  console.log(`  zori_mfr: ${mfrCount?.toLocaleString()}`);

  // Get ALL distinct region_names with pagination
  let allSfrMetros: string[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('zillow_metro')
      .select('region_name')
      .eq('metric_name', 'zori_sfr')
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;

    data.forEach(r => {
      if (!allSfrMetros.includes(r.region_name)) {
        allSfrMetros.push(r.region_name);
      }
    });

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  // Get ALL distinct MFR metros
  let allMfrMetros: string[] = [];
  offset = 0;

  while (true) {
    const { data } = await supabase
      .from('zillow_metro')
      .select('region_name')
      .eq('metric_name', 'zori_mfr')
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;

    data.forEach(r => {
      if (!allMfrMetros.includes(r.region_name)) {
        allMfrMetros.push(r.region_name);
      }
    });

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log('\nUnique metros:');
  console.log(`  zori_sfr: ${allSfrMetros.length} metros`);
  console.log(`  zori_mfr: ${allMfrMetros.length} metros`);

  // Show sample
  allSfrMetros.sort();
  allMfrMetros.sort();

  console.log('\nFirst 10 SFR metros:');
  allSfrMetros.slice(0, 10).forEach(m => console.log(`  - ${m}`));

  console.log('\nLast 10 SFR metros:');
  allSfrMetros.slice(-10).forEach(m => console.log(`  - ${m}`));

  console.log('\nFirst 10 MFR metros:');
  allMfrMetros.slice(0, 10).forEach(m => console.log(`  - ${m}`));

  console.log('\nLast 10 MFR metros:');
  allMfrMetros.slice(-10).forEach(m => console.log(`  - ${m}`));

  // Date range
  const { data: sfrMin } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori_sfr')
    .order('period_date', { ascending: true })
    .limit(1);

  const { data: sfrMax } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zori_sfr')
    .order('period_date', { ascending: false })
    .limit(1);

  console.log('\nDate range:');
  console.log(`  zori_sfr: ${sfrMin?.[0]?.period_date} to ${sfrMax?.[0]?.period_date}`);

  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(70));
}

verify().catch(e => console.error('Error:', e));
