/**
 * Data deep-dive: Listing Price availability by County and ZIP
 *
 * Reports:
 * - Counties: distinct counties in realtor_county with median_listing_price (latest period)
 *   vs. reference (census_county or ~3,143 US counties).
 * - ZIPs: distinct ZIPs in realtor_zip with median_listing_price (latest period), by state.
 *
 * Run: npx tsx scripts/check-listing-price-availability.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 1000;

/** State FIPS (2-digit) to abbreviation */
const STATE_FIPS_TO_ABBR: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY', '72': 'PR',
};

function stateFromCountyFips(countyFips: string): string {
  const s = String(countyFips).padStart(5, '0').slice(0, 2);
  return STATE_FIPS_TO_ABBR[s] ?? s;
}

/** Parse state from zip_name like "City, ST" */
function stateFromZipName(zipName: string | null): string | null {
  if (!zipName || typeof zipName !== 'string') return null;
  const match = zipName.match(/,\s*([A-Z]{2})$/i);
  return match ? match[1].toUpperCase() : null;
}

async function getLatestPeriodDate(table: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return (data as { period_date: string }).period_date;
}

async function getCountyListingPriceCoverage(latestDate: string): Promise<{
  totalCounties: number;
  byState: Record<string, number>;
  countyFipsSet: Set<string>;
}> {
  const countyFipsSet = new Set<string>();
  const byState: Record<string, number> = {};
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('realtor_county')
      .select('county_fips')
      .eq('period_date', latestDate)
      .not('median_listing_price', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as { county_fips: string }[]) {
      const fips = row?.county_fips && String(row.county_fips).trim();
      if (!fips) continue;
      countyFipsSet.add(fips);
      const state = stateFromCountyFips(fips);
      byState[state] = (byState[state] ?? 0) + 1;
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    totalCounties: countyFipsSet.size,
    byState,
    countyFipsSet,
  };
}

async function getZipListingPriceCoverage(latestDate: string): Promise<{
  totalZips: number;
  byState: Record<string, number>;
}> {
  const postalSet = new Set<string>();
  const stateToZips: Record<string, Set<string>> = {};
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('realtor_zip')
      .select('postal_code, zip_name')
      .eq('period_date', latestDate)
      .not('median_listing_price', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as { postal_code: string; zip_name: string | null }[]) {
      const postal = row?.postal_code && String(row.postal_code).trim();
      if (!postal) continue;
      postalSet.add(postal);
      const state = stateFromZipName(row.zip_name) ?? 'Unknown';
      if (!stateToZips[state]) stateToZips[state] = new Set<string>();
      stateToZips[state].add(postal);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const byState: Record<string, number> = {};
  for (const [state, set] of Object.entries(stateToZips)) {
    byState[state] = set.size;
  }

  return { totalZips: postalSet.size, byState };
}

/** Expected county counts per state (Census 2023). Uses state_fips -> abbr. */
async function getCensusCountyCountByState(): Promise<Record<string, number> | null> {
  const seenFips = new Set<string>();
  const byState: Record<string, number> = {};
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('census_county')
      .select('fips_code, state_fips')
      .eq('year', 2023)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return null;
    if (!data || data.length === 0) break;

    for (const row of data as { fips_code: string; state_fips: string }[]) {
      const fips = row?.fips_code && String(row.fips_code).trim();
      if (!fips || seenFips.has(fips)) continue;
      seenFips.add(fips);
      const stateFips = String(row?.state_fips ?? '').padStart(2, '0').slice(0, 2);
      const state = STATE_FIPS_TO_ABBR[stateFips] ?? stateFips;
      byState[state] = (byState[state] ?? 0) + 1;
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return Object.keys(byState).length ? byState : null;
}

async function main() {
  if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('  LISTING PRICE DATA AVAILABILITY DEEP-DIVE (County & ZIP)');
  console.log('='.repeat(70));

  const countyLatest = await getLatestPeriodDate('realtor_county');
  const zipLatest = await getLatestPeriodDate('realtor_zip');

  if (!countyLatest || !zipLatest) {
    console.error('Could not get latest period_date from realtor_county or realtor_zip');
    process.exit(1);
  }

  console.log('\nLatest period_date:');
  console.log('  realtor_county:', countyLatest);
  console.log('  realtor_zip:   ', zipLatest);

  // --- County ---
  console.log('\n' + '-'.repeat(70));
  console.log('LISTING PRICE — COUNTY');
  console.log('-'.repeat(70));

  const countyCoverage = await getCountyListingPriceCoverage(countyLatest);
  const censusByState = await getCensusCountyCountByState();

  console.log('\nCounties with non-null median_listing_price (latest period):', countyCoverage.totalCounties);
  console.log('Reference: US has ~3,143 counties (3,244 with equivalents).');
  if (censusByState) {
    const censusTotal = Object.values(censusByState).reduce((a, b) => a + b, 0);
    console.log('census_county (year 2023) distinct counties:', censusTotal);
    console.log('Gap (missing for listing price):', Math.max(0, censusTotal - countyCoverage.totalCounties), 'counties');
  }

  const statesWithCounties = Object.keys(countyCoverage.byState).filter(s => s.length === 2).sort();
  console.log('\nPer-state county count (realtor_county, listing price available):');
  const stateRows: { state: string; realtor: number; census?: number; gap?: number }[] = statesWithCounties.map(st => ({
    state: st,
    realtor: countyCoverage.byState[st] ?? 0,
    census: censusByState?.[st],
    gap: censusByState?.[st] != null ? Math.max(0, (censusByState[st] ?? 0) - (countyCoverage.byState[st] ?? 0)) : undefined,
  }));

  stateRows.sort((a, b) => (a.realtor - b.realtor));
  console.log('  State | Realtor counties' + (censusByState ? ' | Census counties | Gap' : ''));
  for (const r of stateRows.slice(0, 25)) {
    const line = `  ${r.state}    | ${String(r.realtor).padStart(4)}` +
      (r.census != null ? ` | ${String(r.census).padStart(4)} | ${String(r.gap ?? '').padStart(4)}` : '');
    console.log(line);
  }
  if (stateRows.length > 25) {
    console.log('  ... and', stateRows.length - 25, 'more states.');
  }

  const lowCountyStates = stateRows.filter(r => r.census != null && (r.gap ?? 0) > 10);
  if (lowCountyStates.length > 0) {
    console.log('\nStates with >10 counties missing listing price (vs census):');
    console.log('  ', lowCountyStates.map(r => `${r.state} (gap ${r.gap})`).join(', '));
  }

  // --- ZIP ---
  console.log('\n' + '-'.repeat(70));
  console.log('LISTING PRICE — ZIP');
  console.log('-'.repeat(70));

  const zipCoverage = await getZipListingPriceCoverage(zipLatest);
  console.log('\nZIPs with non-null median_listing_price (latest period):', zipCoverage.totalZips);
  console.log('State is derived from zip_name (e.g. "City, ST").');

  const zipStates = Object.keys(zipCoverage.byState).filter(s => s !== 'Unknown').sort();
  const zipStateRows = zipStates.map(st => ({ state: st, zips: zipCoverage.byState[st] ?? 0 }));
  zipStateRows.sort((a, b) => a.zips - b.zips);

  console.log('\nPer-state ZIP count (realtor_zip, listing price available):');
  console.log('  State | ZIPs');
  for (const r of zipStateRows.slice(0, 30)) {
    console.log(`  ${r.state}    | ${r.zips}`);
  }
  if (zipStateRows.length > 30) {
    console.log('  ... and', zipStateRows.length - 30, 'more states.');
  }

  if (zipCoverage.byState['Unknown'] != null && zipCoverage.byState['Unknown'] > 0) {
    console.log('\nZIPs with state "Unknown" (zip_name missing or format not "City, ST"):', zipCoverage.byState['Unknown']);
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('- Listing price at COUNTY: only counties present in realtor_county with data are shown on the map.');
  console.log('- Many counties are missing because Realtor.com reports only where they have sufficient listing activity.');
  console.log('- Listing price at ZIP: only ZIPs in realtor_zip are shown; ZIPs do not cover every county.');
  console.log('- Per state, some counties have no ZIPs in our dataset (Realtor coverage varies by market).');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
