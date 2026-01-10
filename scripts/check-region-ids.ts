/**
 * Check region_id mapping between tables
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkRegionIds() {
  console.log('=== REGION ID ANALYSIS ===\n');

  // Get distinct region_ids from zillow_zhvi for states
  console.log('1. Zillow ZHVI region_ids (state level):');
  const { data: zhviRegions } = await supabase
    .from('zillow_zhvi')
    .select('region_id')
    .eq('geography', 'state');

  const uniqueZhviIds = [...new Set(zhviRegions?.map(r => r.region_id) || [])];
  console.log('   Sample IDs:', uniqueZhviIds.slice(0, 10).join(', '));
  console.log('   Total unique:', uniqueZhviIds.length);

  // Get state region_ids from markets table
  console.log('\n2. Markets table region_ids (state level):');
  const { data: marketRegions } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .eq('region_type', 'state')
    .limit(10);

  if (marketRegions) {
    console.log('   Sample entries:');
    marketRegions.forEach(m => console.log(`     ${m.region_id} -> ${m.region_name}`));
  }

  // Check if there are markets with Zillow region IDs
  console.log('\n3. Checking for markets with numeric Zillow region_ids:');
  const { data: numericMarkets } = await supabase
    .from('markets')
    .select('region_id, region_name')
    .in('region_id', uniqueZhviIds.slice(0, 20));

  if (numericMarkets && numericMarkets.length > 0) {
    console.log('   Found matching markets:');
    numericMarkets.forEach(m => console.log(`     ${m.region_id} -> ${m.region_name}`));
  } else {
    console.log('   No markets found with Zillow region_ids');
  }

  // Let's see what the actual data looks like
  console.log('\n4. Most recent ZHVI values with any matching market data:');
  const { data: recentZhvi } = await supabase
    .from('zillow_zhvi')
    .select('region_id, date, value')
    .eq('geography', 'state')
    .eq('property_type', 'all_homes')
    .order('date', { ascending: false })
    .limit(10);

  if (recentZhvi) {
    console.table(recentZhvi);
  }

  // Check if Zillow data was imported with state names stored somewhere
  console.log('\n5. Looking for Zillow region ID to state name mapping...');

  // The import script should have created markets entries
  // Let's check if any markets have region_ids that match Zillow format
  const { data: allStateMarkets } = await supabase
    .from('markets')
    .select('region_id, region_name, region_type')
    .eq('region_type', 'state');

  console.log('\n   All state markets:');
  allStateMarkets?.slice(0, 15).forEach(m =>
    console.log(`     ${m.region_id} -> ${m.region_name}`)
  );

  console.log('\n=== ANALYSIS COMPLETE ===');
}

checkRegionIds().catch(console.error);
