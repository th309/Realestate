import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// State abbreviation to FIPS code mapping (copied from census.service.ts)
const STATE_ABBREV_TO_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56', PR: '72', VI: '78', GU: '66', AS: '60', MP: '69',
};

function toStateFips(state: string): string {
  const upper = state.toUpperCase();
  if (STATE_ABBREV_TO_FIPS[upper]) {
    return STATE_ABBREV_TO_FIPS[upper];
  }
  return state.padStart(2, '0');
}

async function test() {
  const state = 'IL';
  const stateFips = toStateFips(state);
  console.log(`Testing IL ZIP query (state_fips = ${stateFips})...\n`);

  const latestYear = 2023;

  // Count for comparison
  const { count } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .eq('year', latestYear)
    .eq('state_fips', stateFips);

  console.log('Actual count in database:', count);

  // Test NEW paginated approach (what the service now does)
  console.log('\nQuery with pagination (new approach):');
  const allData: any[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('census_zip')
      .select('zcta, total_population')
      .eq('year', latestYear)
      .eq('state_fips', stateFips)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.log('Error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    allData.push(...data);
    console.log(`  Batch ${offset / batchSize + 1}: ${data.length} rows`);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  console.log('Total rows fetched:', allData.length);
  console.log('✓ Pagination working:', allData.length === count ? 'YES' : 'NO');
}

test().catch(console.error);
