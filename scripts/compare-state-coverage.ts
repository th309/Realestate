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

async function analyzeState(stateCode: string, stateFips: string, stateName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${stateName} (${stateCode})`);
  console.log('='.repeat(60));

  // Get ZCTAs from tiger_zcta
  const tigerData = await paginatedFetch<{ geoid: string; population: number | null }>(
    'tiger_zcta',
    'geoid, population',
    [{ col: 'default_state', op: 'eq', value: stateCode }]
  );

  // Get ZCTAs from census_zip
  const censusData = await paginatedFetch<{ zcta: string; total_population: number | null }>(
    'census_zip',
    'zcta, total_population',
    [
      { col: 'year', op: 'eq', value: 2023 },
      { col: 'state_fips', op: 'eq', value: stateFips }
    ]
  );

  const censusSet = new Set(censusData.map(z => z.zcta));
  const missingFromCensus = tigerData.filter(z => !censusSet.has(z.geoid));

  // Categorize
  const tigerWithPop = tigerData.filter(z => z.population && z.population > 0);
  const missingWithPop = missingFromCensus.filter(z => z.population && z.population > 0);
  const missingNoPop = missingFromCensus.filter(z => !z.population || z.population === 0);

  console.log('Tiger ZCTAs (shapes):', tigerData.length);
  console.log('  - With population:', tigerWithPop.length);
  console.log('Census ZCTAs (data):', censusData.length);
  console.log('Missing from census:', missingFromCensus.length);
  console.log('  - With population in tiger:', missingWithPop.length);
  console.log('  - No population (unpopulated):', missingNoPop.length);

  const coverageRate = (censusData.length / tigerData.length * 100).toFixed(1);
  const unpopulatedRate = (missingNoPop.length / tigerData.length * 100).toFixed(1);
  console.log('\nCoverage rate:', coverageRate + '%');
  console.log('Unpopulated ZCTAs:', unpopulatedRate + '%');

  if (missingWithPop.length > 0) {
    console.log('\n⚠️  ZCTAs with tiger population but missing census data:');
    for (const z of missingWithPop.slice(0, 5)) {
      console.log(`  ${z.geoid}: pop=${z.population}`);
    }
  }
}

async function main() {
  console.log('Comparing state-level ZCTA coverage...');

  // Check multiple states
  const states = [
    { code: 'TN', fips: '47', name: 'Tennessee' },
    { code: 'CA', fips: '06', name: 'California' },
    { code: 'FL', fips: '12', name: 'Florida' },
    { code: 'TX', fips: '48', name: 'Texas' },
    { code: 'NY', fips: '36', name: 'New York' },
  ];

  for (const state of states) {
    await analyzeState(state.code, state.fips, state.name);
  }
}

main().catch(console.error);
