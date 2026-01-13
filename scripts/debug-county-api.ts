import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function debug() {
  console.log('=== Debugging County API ===\n');

  // 1. Check latest date for County
  const { data: latestDate } = await supabase
    .from('zillow_zhvi')
    .select('date')
    .eq('geography', 'County')
    .order('date', { ascending: false })
    .limit(1);

  console.log('1. Latest County date:', latestDate?.[0]?.date);

  // 2. Check how many counties have data for that date
  const targetDate = latestDate?.[0]?.date || '2025-11-30';
  const { count: countyCountForDate } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County')
    .eq('date', targetDate)
    .eq('property_type', 'sfrcondo')
    .eq('tier', '0.33_0.67');

  console.log(`2. Counties with data for ${targetDate}:`, countyCountForDate);

  // 3. Get all unique FIPS codes from crosswalk (with pagination)
  console.log('\n3. Getting all unique FIPS from crosswalk...');
  let allFips: string[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('county_fips')
      .not('county_fips', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allFips = allFips.concat(data.map(r => r.county_fips));
    page++;
    if (data.length < 1000) break;
  }
  const uniqueFips = [...new Set(allFips)];
  console.log('   Unique FIPS from crosswalk:', uniqueFips.length);

  // 4. Check overlap with zillow_zhvi
  // First get all county region_ids from zillow_zhvi
  console.log('\n4. Getting all county region_ids from zillow_zhvi...');
  let allZhviIds: string[] = [];
  page = 0;
  while (true) {
    const { data } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .eq('date', targetDate)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allZhviIds = allZhviIds.concat(data.map(r => r.region_id));
    page++;
    if (data.length < 1000) break;
  }
  const uniqueZhviIds = [...new Set(allZhviIds)];
  console.log('   Unique county IDs in zillow_zhvi for', targetDate + ':', uniqueZhviIds.length);

  // 5. Check intersection
  const intersection = uniqueFips.filter(f => uniqueZhviIds.includes(f));
  console.log('\n5. Counties in BOTH crosswalk AND zillow_zhvi:', intersection.length);

  // 6. Sample of what's missing
  const inCrosswalkOnly = uniqueFips.filter(f => !uniqueZhviIds.includes(f));
  const inZhviOnly = uniqueZhviIds.filter(f => !uniqueFips.includes(f));
  console.log('   In crosswalk only:', inCrosswalkOnly.length);
  console.log('   In zillow_zhvi only:', inZhviOnly.length);

  if (inZhviOnly.length > 0 && inZhviOnly.length <= 20) {
    console.log('   Sample zillow_zhvi IDs not in crosswalk:', inZhviOnly);
  }
}

debug();
