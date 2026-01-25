/**
 * Verify Days on Market county coverage.
 *
 * Reports for the latest realtor_county period_date:
 * - Count of counties with non-null median_days_on_market (what the map shows)
 * - Optionally: total US counties (census_county or ~3,143) to document the "white space"
 *
 * Map white space = counties that have no row in realtor_county for that date, or
 * median_days_on_market is null (Realtor.com only reports where they have sufficient activity).
 *
 * Run: npx tsx scripts/verify-days-on-market-county-coverage.ts
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

async function getCountyDomCoverage(latestDate: string): Promise<{
  totalCounties: number;
  withDom: number;
  withNullDom: number;
}> {
  const countiesWithDom = new Set<string>();
  const allCountyFips = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('realtor_county')
      .select('county_fips, median_days_on_market')
      .eq('period_date', latestDate)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as { county_fips: string; median_days_on_market: number | null }[]) {
      const fips = row?.county_fips && String(row.county_fips).trim();
      if (!fips) continue;
      allCountyFips.add(fips);
      if (row.median_days_on_market != null && !Number.isNaN(Number(row.median_days_on_market))) {
        countiesWithDom.add(fips);
      }
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const totalCounties = allCountyFips.size;
  const withDom = countiesWithDom.size;
  const withNullDom = totalCounties - withDom;

  return {
    totalCounties,
    withDom,
    withNullDom,
  };
}

/** Distinct county count from census_county for a recent year (reference total US counties). */
async function getCensusCountyCount(): Promise<number | null> {
  const seen = new Set<string>();
  let offset = 0;
  const year = 2023;
  while (true) {
    const { data, error } = await supabase
      .from('census_county')
      .select('fips_code')
      .eq('year', year)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return null;
    if (!data || data.length === 0) break;
    for (const row of data as { fips_code: string }[]) {
      const fips = row?.fips_code && String(row.fips_code).trim();
      if (fips) seen.add(fips);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return seen.size || null;
}

async function main() {
  console.log('Days on Market — County coverage (realtor_county)\n');

  const latestDate = await getLatestPeriodDate('realtor_county');
  if (!latestDate) {
    console.error('Could not get latest period_date from realtor_county');
    process.exit(1);
  }
  console.log(`Latest period_date: ${latestDate}`);

  const { totalCounties, withDom, withNullDom } = await getCountyDomCoverage(latestDate);
  console.log(`  Counties in realtor_county for this date: ${totalCounties}`);
  console.log(`  With median_days_on_market (map colored): ${withDom}`);
  console.log(`  With null median_days_on_market (map white): ${withNullDom}`);

  // Reference: US has ~3,143 counties (3,244 with equivalents)
  const censusTotal = await getCensusCountyCount();
  if (censusTotal != null) {
    console.log(`\nReference: census_county distinct count: ${censusTotal}`);
    const missing = Math.max(0, censusTotal - totalCounties);
    console.log(`  Counties with no realtor_county row at all: ${missing}`);
  } else {
    console.log('\nReference: US has ~3,143 counties (3,244 with equivalents).');
    console.log(`  Counties with no realtor_county row: ~${Math.max(0, 3143 - totalCounties)}`);
  }

  console.log('\nConclusion:');
  console.log('- Map "white space" for Days on Market at county = counties either missing from');
  console.log('  realtor_county for this date or with null median_days_on_market (Realtor.com');
  console.log('  reports only where they have sufficient listing activity).');
  console.log('- This is source data coverage, not an application bug.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
