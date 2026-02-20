import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Total county records
  const { count: totalCountyRecords } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');
  console.log('Total County records in zillow_zhvi:', totalCountyRecords);

  // Sample region_ids for counties
  const { data: sample } = await supabase
    .from('zillow_zhvi')
    .select('region_id, date, value')
    .eq('geography', 'County')
    .limit(50);

  console.log('\nSample county region_ids:');
  const regionIds = sample?.map(r => r.region_id) || [];
  console.log(regionIds);

  // Unique region_ids
  const uniqueIds = [...new Set(regionIds)];
  console.log('\nUnique region_ids in sample:', uniqueIds.length);
  console.log('IDs:', uniqueIds.sort());

  // Check if these look like FIPS codes (5 digits, numeric) or Zillow IDs (longer)
  console.log('\n--- Analysis ---');
  const fipsLike = uniqueIds.filter(id => /^\d{5}$/.test(id));
  const zillowLike = uniqueIds.filter(id => !/^\d{5}$/.test(id));
  console.log('FIPS-like (5 digits):', fipsLike.length);
  console.log('Zillow ID-like (not 5 digits):', zillowLike.length);

  if (zillowLike.length > 0) {
    console.log('\nZillow-style IDs found:', zillowLike);
  }

  // Get all unique county region_ids with pagination
  console.log('\n--- All unique county region_ids ---');
  let allIds: string[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;
    allIds = allIds.concat(data.map(r => r.region_id));
    page++;
    if (data.length < pageSize) break;
  }

  const allUnique = [...new Set(allIds)];
  console.log('Total unique county region_ids:', allUnique.length);

  // Check format distribution
  const fipsFormat = allUnique.filter(id => /^\d{5}$/.test(id));
  const otherFormat = allUnique.filter(id => !/^\d{5}$/.test(id));
  console.log('FIPS format (5-digit):', fipsFormat.length);
  console.log('Other format:', otherFormat.length);

  if (otherFormat.length > 0 && otherFormat.length <= 20) {
    console.log('Other format IDs:', otherFormat);
  }

  // Check crosswalk for zillow_county_region_id
  console.log('\n--- Check crosswalk zillow_county_region_id ---');
  const { data: crosswalkSample } = await supabase
    .from('geography_crosswalk')
    .select('county_fips, county_name, zillow_county_region_id')
    .not('zillow_county_region_id', 'is', null)
    .limit(20);

  console.log('Sample crosswalk with zillow_county_region_id:');
  crosswalkSample?.forEach(row => {
    console.log(`  FIPS: ${row.county_fips}, Zillow ID: ${row.zillow_county_region_id}, Name: ${row.county_name}`);
  });

  // Count unique zillow_county_region_id
  let allZillowIds: string[] = [];
  page = 0;
  while (true) {
    const { data } = await supabase
      .from('geography_crosswalk')
      .select('zillow_county_region_id')
      .not('zillow_county_region_id', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!data || data.length === 0) break;
    allZillowIds = allZillowIds.concat(data.map(r => String(r.zillow_county_region_id)));
    page++;
    if (data.length < pageSize) break;
  }

  const uniqueZillowIds = [...new Set(allZillowIds)];
  console.log('\nTotal unique zillow_county_region_id in crosswalk:', uniqueZillowIds.length);
  console.log('Sample:', uniqueZillowIds.slice(0, 20));
}

check();
