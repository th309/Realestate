/**
 * Check Population data coverage at all geography levels
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  console.log('='.repeat(60));
  console.log('Population Data Coverage Check');
  console.log('='.repeat(60));

  // Record counts with population
  const tables = [
    'census_national',
    'census_state',
    'census_metro',
    'census_county',
    'census_city',
    'census_zip'
  ];

  for (const t of tables) {
    const { count: total } = await supabase.from(t).select('*', { count: 'exact', head: true });
    const { count: withPop } = await supabase.from(t).select('*', { count: 'exact', head: true }).not('total_population', 'is', null);
    const { count: year2023 } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('year', 2023);
    const { count: year2023Pop } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('year', 2023).not('total_population', 'is', null);
    console.log(`\n${t}:`);
    console.log(`  Total records: ${total || 0}`);
    console.log(`  With population: ${withPop || 0}`);
    console.log(`  Year 2023: ${year2023 || 0}`);
    console.log(`  Year 2023 with pop: ${year2023Pop || 0}`);
  }

  // Sample county data
  console.log('\n--- Sample County Data (2023, top 5) ---');
  const { data: counties } = await supabase
    .from('census_county')
    .select('fips_code, county_name, state_name, total_population')
    .eq('year', 2023)
    .not('total_population', 'is', null)
    .order('total_population', { ascending: false })
    .limit(5);
  for (const c of counties || []) {
    console.log(`  ${c.county_name}, ${c.state_name} (${c.fips_code}): ${c.total_population?.toLocaleString()}`);
  }

  // Sample city data
  console.log('\n--- Sample City Data (2023, top 5) ---');
  const { data: cities } = await supabase
    .from('census_city')
    .select('place_fips, place_name, state_name, total_population')
    .eq('year', 2023)
    .not('total_population', 'is', null)
    .order('total_population', { ascending: false })
    .limit(5);
  if (!cities || cities.length === 0) {
    console.log('  NO DATA FOUND');
  } else {
    for (const c of cities) {
      console.log(`  ${c.place_name}, ${c.state_name} (${c.place_fips}): ${c.total_population?.toLocaleString()}`);
    }
  }

  // Sample ZIP data
  console.log('\n--- Sample ZIP Data (2023, top 5) ---');
  const { data: zips } = await supabase
    .from('census_zip')
    .select('zcta, state_name, total_population')
    .eq('year', 2023)
    .not('total_population', 'is', null)
    .order('total_population', { ascending: false })
    .limit(5);
  if (!zips || zips.length === 0) {
    console.log('  NO DATA FOUND');
  } else {
    for (const z of zips) {
      console.log(`  ${z.zcta} (${z.state_name}): ${z.total_population?.toLocaleString()}`);
    }
  }
}

check().catch(console.error);
