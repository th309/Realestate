/**
 * Fix ZHVI query - check indexes and optimize
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function analyze() {
  console.log('=== ZHVI Query Analysis ===\n');

  // 1. Count total records in zillow_zhvi
  console.log('1. Checking zillow_zhvi table size...');
  const { count: totalCount } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${totalCount?.toLocaleString()}`);

  // 2. Try a simple query with a small limit
  console.log('\n2. Testing simple query with limit...');
  const { data: sample, error: sampleErr } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date, geography, property_type')
    .limit(5);

  if (sampleErr) {
    console.log('   Error:', sampleErr.message);
  } else {
    console.log('   Sample data:');
    console.table(sample);
  }

  // 3. Check distinct geographies
  console.log('\n3. Checking distinct geography values...');
  const { data: geos, error: geoErr } = await supabase
    .from('zillow_zhvi')
    .select('geography')
    .limit(1000);

  if (!geoErr && geos) {
    const distinctGeos = [...new Set(geos.map(g => g.geography))];
    console.log('   Geographies found:', distinctGeos.join(', '));
  }

  // 4. Try a more targeted query
  console.log('\n4. Testing targeted state query with limit...');
  const startTime = Date.now();
  const { data: stateData, error: stateErr, count: stateCount } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date', { count: 'exact' })
    .eq('geography', 'state')
    .eq('property_type', 'all_homes')
    .order('date', { ascending: false })
    .limit(100);

  const queryTime = Date.now() - startTime;

  if (stateErr) {
    console.log('   Error:', stateErr.message);
  } else {
    console.log(`   Found ${stateCount} state records (query took ${queryTime}ms)`);
    if (stateData && stateData.length > 0) {
      console.log('   Sample:');
      console.table(stateData.slice(0, 5));
    }
  }

  // 5. Get most recent date for states
  console.log('\n5. Getting most recent state ZHVI data...');
  const { data: recent, error: recentErr } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .eq('geography', 'state')
    .eq('property_type', 'all_homes')
    .order('date', { ascending: false })
    .limit(51);  // Just get 51 states, most recent date first

  if (recentErr) {
    console.log('   Error:', recentErr.message);
  } else {
    console.log(`   Got ${recent?.length} records`);

    // Get unique states with most recent value
    const stateValues = new Map<string, { value: number; date: string }>();
    for (const r of recent || []) {
      if (!stateValues.has(r.region_id)) {
        stateValues.set(r.region_id, { value: r.value, date: r.date });
      }
    }
    console.log(`   Unique states: ${stateValues.size}`);
    console.log('   Sample:');
    [...stateValues.entries()].slice(0, 5).forEach(([id, data]) => {
      console.log(`     Region ${id}: $${Math.round(data.value).toLocaleString()} (${data.date})`);
    });
  }
}

analyze();
