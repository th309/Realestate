import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

async function check() {
  // Search for Dayton in crosswalk
  const { data: dayton } = await supabase
    .from('zillow_metro_crosswalk')
    .select('*')
    .ilike('zillow_region_name', '%dayton%');

  console.log('Dayton in crosswalk:');
  if (dayton && dayton.length > 0) {
    dayton.forEach(r => console.log(`  ID: ${r.zillow_region_id}, Name: ${r.zillow_region_name}, CBSA: ${r.cbsa_code}`));
  } else {
    console.log('  NOT FOUND');
  }

  // Check Poughkeepsie
  const { data: pough } = await supabase
    .from('zillow_metro_crosswalk')
    .select('*')
    .ilike('zillow_region_name', '%pough%');

  console.log('\nPoughkeepsie in crosswalk:');
  if (pough && pough.length > 0) {
    pough.forEach(r => console.log(`  ID: ${r.zillow_region_id}, Name: ${r.zillow_region_name}, CBSA: ${r.cbsa_code}`));
  } else {
    console.log('  NOT FOUND');
  }

  // Check all skipped metros by name
  const skippedNames = [
    'Dayton', 'Poughkeepsie', 'Prescott', 'Lebanon', 'Wooster',
    'Jasper', 'Granbury', 'Cullowhee', 'Fort Polk', 'Fort Dodge',
    'Bonham', 'Coffeyville', 'Rockport', 'Brownsville', 'Ottawa', 'Pella'
  ];

  console.log('\n--- Checking all skipped metros ---');
  for (const name of skippedNames) {
    const { data } = await supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, zillow_region_name, cbsa_code')
      .ilike('zillow_region_name', `%${name}%`);

    console.log(`\n${name}:`);
    if (data && data.length > 0) {
      data.forEach(r => console.log(`  ID: ${r.zillow_region_id}, Name: ${r.zillow_region_name}, CBSA: ${r.cbsa_code}`));
    } else {
      console.log('  NOT FOUND in crosswalk');
    }
  }
}

check().catch(e => console.error('Error:', e));
