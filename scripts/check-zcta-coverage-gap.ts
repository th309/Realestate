import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking ZCTA coverage gap...\n');

  // 1. Count ZCTAs in tiger_zcta (the GeoJSON source)
  console.log('=== tiger_zcta (GeoJSON source) ===');
  try {
    const { count: totalTiger } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true });
    console.log('Total ZCTAs in tiger_zcta:', totalTiger);

    const { count: caTiger } = await supabase
      .from('tiger_zcta')
      .select('*', { count: 'exact', head: true })
      .eq('default_state', 'CA');
    console.log('CA ZCTAs in tiger_zcta:', caTiger);
  } catch (e: any) {
    console.log('tiger_zcta error:', e.message);
  }

  // 2. Count ZCTAs in census_zip with population data
  console.log('\n=== census_zip (population data) ===');
  try {
    const { count: totalCensus } = await supabase
      .from('census_zip')
      .select('*', { count: 'exact', head: true })
      .eq('year', 2023)
      .not('total_population', 'is', null);
    console.log('Total ZCTAs with population:', totalCensus);

    const { count: caCensus } = await supabase
      .from('census_zip')
      .select('*', { count: 'exact', head: true })
      .eq('year', 2023)
      .eq('state_fips', '06')
      .not('total_population', 'is', null);
    console.log('CA ZCTAs with population:', caCensus);
  } catch (e: any) {
    console.log('census_zip error:', e.message);
  }

  // 3. Find ZCTAs in tiger_zcta that DON'T have census data
  console.log('\n=== Coverage Gap Analysis (CA) ===');
  try {
    // Get all CA ZCTAs from tiger_zcta
    const { data: tigerZctas } = await supabase
      .from('tiger_zcta')
      .select('zcta5ce20')
      .eq('default_state', 'CA');

    const tigerSet = new Set(tigerZctas?.map(z => z.zcta5ce20) || []);
    console.log('CA ZCTAs in tiger_zcta:', tigerSet.size);

    // Get all CA ZCTAs from census_zip
    const { data: censusZctas } = await supabase
      .from('census_zip')
      .select('zcta')
      .eq('year', 2023)
      .eq('state_fips', '06')
      .not('total_population', 'is', null);

    const censusSet = new Set(censusZctas?.map(z => z.zcta) || []);
    console.log('CA ZCTAs in census_zip:', censusSet.size);

    // Find gaps
    const inTigerNotCensus = [...tigerSet].filter(z => !censusSet.has(z));
    const inCensusNotTiger = [...censusSet].filter(z => !tigerSet.has(z));

    console.log('\nZCTAs in tiger_zcta but NOT in census_zip:', inTigerNotCensus.length);
    console.log('  Sample:', inTigerNotCensus.slice(0, 10).join(', '));

    console.log('\nZCTAs in census_zip but NOT in tiger_zcta:', inCensusNotTiger.length);
    console.log('  Sample:', inCensusNotTiger.slice(0, 10).join(', '));

  } catch (e: any) {
    console.log('Coverage gap analysis error:', e.message);
  }

  // 4. Check if census_zip has more years of data
  console.log('\n=== census_zip years available ===');
  try {
    const { data: years } = await supabase
      .from('census_zip')
      .select('year')
      .order('year', { ascending: false })
      .limit(100);

    const uniqueYears = [...new Set(years?.map(y => y.year))];
    console.log('Available years:', uniqueYears.join(', '));
  } catch (e: any) {
    console.log('Years check error:', e.message);
  }

  // 5. Check what columns census_zip has
  console.log('\n=== census_zip sample record ===');
  try {
    const { data: sample } = await supabase
      .from('census_zip')
      .select('*')
      .eq('state_fips', '06')
      .eq('year', 2023)
      .limit(1);

    if (sample && sample[0]) {
      console.log('Columns:', Object.keys(sample[0]).join(', '));
    }
  } catch (e: any) {
    console.log('Sample error:', e.message);
  }
}

check().catch(console.error);
