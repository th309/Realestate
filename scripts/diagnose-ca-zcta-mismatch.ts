import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function loadAllWithPagination(table: string, selectCols: string, filters: Record<string, any>) {
  const results: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    let query = supabase.from(table).select(selectCols).range(offset, offset + batchSize - 1);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data } = await query;
    if (!data || data.length === 0) break;
    results.push(...data);
    offset += batchSize;
    if (data.length < batchSize) break;
  }

  return results;
}

async function check() {
  console.log('Diagnosing California ZCTA mismatch...\n');

  // Get ALL CA ZCTAs from tiger_zcta with pagination
  console.log('Loading all CA ZCTAs from tiger_zcta...');
  const tigerData = await loadAllWithPagination('tiger_zcta', 'geoid, default_city', { default_state: 'CA' });
  const tigerZctas = new Set(tigerData.map(z => z.geoid));
  console.log('Total CA ZCTAs in tiger_zcta:', tigerZctas.size);

  // Get ALL CA ZCTAs from census_zip with pagination
  console.log('Loading all CA ZCTAs from census_zip...');
  const censusData = await loadAllWithPagination('census_zip', 'zcta, total_population', { year: 2023, state_fips: '06' });
  const censusZctas = new Set(censusData.map(z => z.zcta));
  console.log('Total CA ZCTAs in census_zip:', censusZctas.size);

  // Analyze the mismatch
  const matching = [...tigerZctas].filter(z => censusZctas.has(z));
  const inTigerOnly = [...tigerZctas].filter(z => !censusZctas.has(z));
  const inCensusOnly = [...censusZctas].filter(z => !tigerZctas.has(z));

  console.log('\n=== Match Analysis ===');
  console.log('Matching ZCTAs:', matching.length);
  console.log('In tiger_zcta only:', inTigerOnly.length);
  console.log('In census_zip only:', inCensusOnly.length);

  // Look at the ZCTA patterns
  console.log('\n=== ZCTA Pattern Analysis ===');

  // Tiger ZCTAs
  const tigerPrefixes: Record<string, number> = {};
  for (const z of tigerZctas) {
    const prefix = z.substring(0, 3);
    tigerPrefixes[prefix] = (tigerPrefixes[prefix] || 0) + 1;
  }
  console.log('Tiger ZCTA prefixes (first 10):', Object.entries(tigerPrefixes).slice(0, 10));

  // Census ZCTAs
  const censusPrefixes: Record<string, number> = {};
  for (const z of censusZctas) {
    const prefix = z.substring(0, 3);
    censusPrefixes[prefix] = (censusPrefixes[prefix] || 0) + 1;
  }
  console.log('Census ZCTA prefixes (first 10):', Object.entries(censusPrefixes).slice(0, 10));

  // Check specific popular CA prefixes
  console.log('\n=== Specific Prefix Check ===');
  const caZipPrefixes = ['900', '901', '902', '910', '920', '930', '940', '950', '960'];
  for (const prefix of caZipPrefixes) {
    const tigerCount = [...tigerZctas].filter(z => z.startsWith(prefix)).length;
    const censusCount = [...censusZctas].filter(z => z.startsWith(prefix)).length;
    console.log(`${prefix}xx: tiger=${tigerCount}, census=${censusCount}`);
  }

  // Show specific examples of mismatches
  console.log('\n=== Sample Mismatched ZCTAs ===');
  console.log('In tiger but not census (sample):', inTigerOnly.slice(0, 10));
  console.log('In census but not tiger (sample):', inCensusOnly.slice(0, 10));

  // Check if census ZCTAs might be in wrong state
  console.log('\n=== Checking if census ZCTAs exist in tiger for OTHER states ===');
  for (const zcta of inCensusOnly.slice(0, 5)) {
    const { data } = await supabase
      .from('tiger_zcta')
      .select('geoid, default_state')
      .eq('geoid', zcta)
      .limit(1);

    if (data && data.length > 0) {
      console.log(`  ${zcta} is in tiger_zcta as state: ${data[0].default_state}`);
    } else {
      console.log(`  ${zcta} not found in tiger_zcta at all`);
    }
  }
}

check().catch(console.error);
