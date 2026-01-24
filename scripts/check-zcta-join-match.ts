import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('Checking ZCTA code matching between tables...\n');

  // Get TN ZCTAs from both tables and compare
  console.log('=== Tennessee ===');

  // Get TN ZCTAs from tiger_zcta (using geoid column)
  const { data: tnTiger } = await supabase
    .from('tiger_zcta')
    .select('geoid')
    .eq('default_state', 'TN');

  const tnTigerSet = new Set(tnTiger?.map(z => z.geoid) || []);
  console.log('TN ZCTAs in tiger_zcta:', tnTigerSet.size);
  console.log('Sample tiger geoids:', [...tnTigerSet].slice(0, 5));

  // Get TN ZCTAs from census_zip (using zcta column)
  const { data: tnCensus } = await supabase
    .from('census_zip')
    .select('zcta')
    .eq('year', 2023)
    .eq('state_fips', '47');

  const tnCensusSet = new Set(tnCensus?.map(z => z.zcta) || []);
  console.log('TN ZCTAs in census_zip:', tnCensusSet.size);
  console.log('Sample census zctas:', [...tnCensusSet].slice(0, 5));

  // Check overlap
  const tnMatches = [...tnTigerSet].filter(z => tnCensusSet.has(z));
  const tnInTigerNotCensus = [...tnTigerSet].filter(z => !tnCensusSet.has(z));
  const tnInCensusNotTiger = [...tnCensusSet].filter(z => !tnTigerSet.has(z));

  console.log('\nTN Matching ZCTAs:', tnMatches.length);
  console.log('TN Match rate:', (tnMatches.length / tnTigerSet.size * 100).toFixed(1) + '%');
  console.log('TN In tiger but not census:', tnInTigerNotCensus.length, '- Sample:', tnInTigerNotCensus.slice(0, 5));
  console.log('TN In census but not tiger:', tnInCensusNotTiger.length, '- Sample:', tnInCensusNotTiger.slice(0, 5));

  // Do the same for California
  console.log('\n=== California ===');

  const { data: caTiger } = await supabase
    .from('tiger_zcta')
    .select('geoid')
    .eq('default_state', 'CA');

  const caTigerSet = new Set(caTiger?.map(z => z.geoid) || []);
  console.log('CA ZCTAs in tiger_zcta:', caTigerSet.size);
  console.log('Sample tiger geoids:', [...caTigerSet].slice(0, 5));

  const { data: caCensus } = await supabase
    .from('census_zip')
    .select('zcta')
    .eq('year', 2023)
    .eq('state_fips', '06');

  const caCensusSet = new Set(caCensus?.map(z => z.zcta) || []);
  console.log('CA ZCTAs in census_zip:', caCensusSet.size);
  console.log('Sample census zctas:', [...caCensusSet].slice(0, 5));

  const caMatches = [...caTigerSet].filter(z => caCensusSet.has(z));
  const caInTigerNotCensus = [...caTigerSet].filter(z => !caCensusSet.has(z));
  const caInCensusNotTiger = [...caCensusSet].filter(z => !caTigerSet.has(z));

  console.log('\nCA Matching ZCTAs:', caMatches.length);
  console.log('CA Match rate:', (caMatches.length / caTigerSet.size * 100).toFixed(1) + '%');
  console.log('CA In tiger but not census:', caInTigerNotCensus.length, '- Sample:', caInTigerNotCensus.slice(0, 5));
  console.log('CA In census but not tiger:', caInCensusNotTiger.length, '- Sample:', caInCensusNotTiger.slice(0, 5));

  // Check if these are valid CA ZIP codes that just don't have ACS data
  if (caInTigerNotCensus.length > 0) {
    console.log('\n=== Checking missing CA ZCTAs ===');
    // Check a few of these in realtor_zip or zillow_zip
    const sample = caInTigerNotCensus.slice(0, 10);
    console.log('Checking if these ZCTAs have data in other sources:', sample);

    for (const zcta of sample.slice(0, 3)) {
      const { count: realtorCount } = await supabase
        .from('realtor_zip')
        .select('*', { count: 'exact', head: true })
        .eq('postal_code', zcta);

      const { count: zillowCount } = await supabase
        .from('zillow_zip')
        .select('*', { count: 'exact', head: true })
        .eq('region_name', zcta);

      console.log(`  ${zcta}: realtor_zip=${realtorCount}, zillow_zip=${zillowCount}`);
    }
  }
}

check().catch(console.error);
