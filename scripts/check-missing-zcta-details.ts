import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function paginatedFetch<T>(
  table: string,
  select: string,
  filters: { col: string; op: 'eq' | 'is' | 'not'; value: any }[]
): Promise<T[]> {
  const results: T[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(offset, offset + batchSize - 1);

    for (const filter of filters) {
      if (filter.op === 'eq') {
        query = query.eq(filter.col, filter.value);
      } else if (filter.op === 'is') {
        query = query.is(filter.col, filter.value);
      } else if (filter.op === 'not') {
        query = query.not(filter.col, 'is', filter.value);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    results.push(...(data as T[]));
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return results;
}

async function check() {
  console.log('Analyzing missing CA ZCTAs...\n');

  // Get all CA ZCTAs from tiger_zcta
  console.log('Loading CA ZCTAs from tiger_zcta (with pagination)...');
  const tigerData = await paginatedFetch<{ geoid: string; population: number | null; default_city: string }>(
    'tiger_zcta',
    'geoid, population, default_city',
    [{ col: 'default_state', op: 'eq', value: 'CA' }]
  );
  console.log('Loaded', tigerData.length, 'CA ZCTAs from tiger_zcta');

  // Get all CA ZCTAs from census_zip
  console.log('Loading CA ZCTAs from census_zip (with pagination)...');
  const censusData = await paginatedFetch<{ zcta: string; total_population: number | null }>(
    'census_zip',
    'zcta, total_population',
    [
      { col: 'year', op: 'eq', value: 2023 },
      { col: 'state_fips', op: 'eq', value: '06' }
    ]
  );
  console.log('Loaded', censusData.length, 'CA ZCTAs from census_zip');

  const censusSet = new Set(censusData.map(z => z.zcta));

  // Find ZCTAs in tiger but not in census
  const missingFromCensus = tigerData.filter(z => !censusSet.has(z.geoid));
  console.log('\nZCTAs in tiger but NOT in census:', missingFromCensus.length);

  // Categorize missing ZCTAs
  const withTigerPop = missingFromCensus.filter(z => z.population && z.population > 0);
  const withoutPop = missingFromCensus.filter(z => !z.population || z.population === 0);

  console.log('  - With population in tiger:', withTigerPop.length);
  console.log('  - Without population (null/0):', withoutPop.length);

  // Show the ones WITH population - these are the ones we could potentially add
  console.log('\n=== Missing ZCTAs WITH population in tiger (could add to census_zip) ===');
  console.log('Sample (first 20):');
  for (const z of withTigerPop.slice(0, 20)) {
    console.log(`  ${z.geoid}: pop=${z.population}, city=${z.default_city}`);
  }

  // Check if these ZCTAs exist in other data sources
  console.log('\n=== Checking other data sources for missing ZCTAs ===');
  const sampleMissing = withTigerPop.slice(0, 5).map(z => z.geoid);

  for (const zcta of sampleMissing) {
    // Check realtor_zip
    const { count: realtorCount } = await supabase
      .from('realtor_zip')
      .select('*', { count: 'exact', head: true })
      .eq('postal_code', zcta);

    // Check zillow_zip
    const { count: zillowCount } = await supabase
      .from('zillow_zip')
      .select('*', { count: 'exact', head: true })
      .eq('region_name', zcta);

    console.log(`  ${zcta}: realtor=${realtorCount}, zillow=${zillowCount}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log('Total CA ZCTAs with shapes:', tigerData.length);
  console.log('CA ZCTAs with census data:', censusData.length);
  console.log('Missing from census:', missingFromCensus.length);
  console.log('  - Could be filled from tiger population:', withTigerPop.length);
  console.log('  - Truly unpopulated (null/0 population):', withoutPop.length);
}

check().catch(console.error);
