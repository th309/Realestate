#!/usr/bin/env npx tsx
/**
 * Census & Economic unified data import entry point.
 *
 * Fetches data from 4 APIs (Census ACS, BEA, FRED, BLS) and upserts
 * into census_* and economic_* database tables.
 *
 * Unlike Zillow/Realtor adapters, this source is API-based rather than
 * CSV file-based, so it cannot use runSourceImport() directly. Instead
 * it calls each API client, collects records, then uses batchUpsert()
 * from the shared framework.
 *
 * Usage:
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --census
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --economic
 *   npx tsx scripts/sources/census-economic/import-census-economic.ts --quick
 */

import type { IngestionSource } from '../../utils/ingestion-logger';
import {
  CENSUS_YEARS_FULL,
  CENSUS_YEARS_QUICK,
  CENSUS_TABLES,
  ECONOMIC_TABLES,
} from './census-economic-config';
import {
  fetchCensusNational, fetchCensusStates, fetchCensusMetros,
  fetchCensusCounties, fetchCensusCities, fetchCensusZips,
} from './census-api-client';
import {
  fetchBeaStateGdp, fetchBeaStateRealGdp, fetchBeaStateRpp,
  fetchBeaMetroGdp, fetchBeaMetroRpp,
  fetchBeaCountyGdp,
} from './bea-api-client';
import {
  fetchFredNationalUnemployment, fetchFredNationalEmployment,
  fetchFredStateUnemployment, fetchFredStateEmployment,
  fetchFredMetroUnemployment, fetchFredMetroEmployment,
} from './fred-api-client';
import { fetchBlsCountyUnemployment } from './bls-api-client';
import { upsertWithLogging, mergeByKey } from './census-economic-upsert';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const importCensus = args.length === 0 || args.includes('--census');
const importEconomic = args.length === 0 || args.includes('--economic');
const quickMode = args.includes('--quick');

const censusYears = quickMode ? CENSUS_YEARS_QUICK : CENSUS_YEARS_FULL;
const fredStartYear = quickMode ? 2020 : 2000;

// ---------------------------------------------------------------------------
// Census data import (Census ACS 5-Year)
// ---------------------------------------------------------------------------

async function importAllCensusData(): Promise<{ inserted: number; failed: number }> {
  console.log('\n' + '='.repeat(60));
  console.log(`Importing Census ACS Data for ${censusYears.length} years`);
  console.log('='.repeat(60));

  let totalInserted = 0;
  let totalFailed = 0;

  const allNational: Record<string, unknown>[] = [];
  const allStates: Record<string, unknown>[] = [];
  const allMetros: Record<string, unknown>[] = [];
  const allCounties: Record<string, unknown>[] = [];
  const allCities: Record<string, unknown>[] = [];
  const allZips: Record<string, unknown>[] = [];

  for (const year of censusYears) {
    console.log(`\n--- Census ACS Year ${year} ---`);
    allNational.push(...await fetchCensusNational(year));
    allStates.push(...await fetchCensusStates(year));
    allMetros.push(...await fetchCensusMetros(year));
    allCounties.push(...await fetchCensusCounties(year));
    allCities.push(...await fetchCensusCities(year));
    allZips.push(...await fetchCensusZips(year));
  }

  const geoData: Array<{ records: Record<string, unknown>[]; geo: string; source: IngestionSource }> = [
    { records: allNational, geo: 'national', source: 'census' },
    { records: allStates, geo: 'state', source: 'census' },
    { records: allMetros, geo: 'metro', source: 'census' },
    { records: allCounties, geo: 'county', source: 'census' },
    { records: allCities, geo: 'city', source: 'census' },
    { records: allZips, geo: 'zip', source: 'census' },
  ];

  for (const { records, geo, source } of geoData) {
    const table = CENSUS_TABLES[geo];
    const result = await upsertWithLogging({
      source,
      tableName: table.tableName,
      conflictKeys: table.conflictKeys,
      datasetId: `census-${geo}`,
      records,
    });
    totalInserted += result.inserted;
    totalFailed += result.failed;
  }

  return { inserted: totalInserted, failed: totalFailed };
}

// ---------------------------------------------------------------------------
// Economic data import (BEA + FRED + BLS)
// ---------------------------------------------------------------------------

async function importAllEconomicData(): Promise<{ inserted: number; failed: number }> {
  console.log('\n' + '='.repeat(60));
  console.log(`Importing Economic Data (BEA + FRED + BLS) from ${fredStartYear}`);
  console.log('='.repeat(60));

  let totalInserted = 0;
  let totalFailed = 0;

  // National: FRED unemployment + employment merged by date
  const nationalMerged = mergeByKey(
    [...await fetchFredNationalUnemployment(fredStartYear), ...await fetchFredNationalEmployment(fredStartYear)],
    'period_date',
  );
  const natResult = await upsertWithLogging({
    source: 'fred', tableName: ECONOMIC_TABLES.national.tableName,
    conflictKeys: ECONOMIC_TABLES.national.conflictKeys,
    datasetId: 'economic-national', records: nationalMerged,
  });
  totalInserted += natResult.inserted;
  totalFailed += natResult.failed;

  // State: FRED unemployment + employment + BEA GDP + real GDP + RPP
  // Source is 'census' (the Census/Economic umbrella) because data merges FRED + BEA
  const stateAll = [
    ...await fetchFredStateUnemployment(fredStartYear),
    ...await fetchFredStateEmployment(fredStartYear),
    ...await fetchBeaStateGdp(),
    ...await fetchBeaStateRealGdp(),
    ...await fetchBeaStateRpp(),
  ];
  const stateResult = await upsertWithLogging({
    source: 'census', tableName: ECONOMIC_TABLES.state.tableName,
    conflictKeys: ECONOMIC_TABLES.state.conflictKeys,
    datasetId: 'economic-state', records: mergeByKey(stateAll, 'period_date', 'state_fips'),
  });
  totalInserted += stateResult.inserted;
  totalFailed += stateResult.failed;

  // Metro: FRED unemployment + employment + BEA GDP + RPP
  // Source is 'census' (the Census/Economic umbrella) because data merges FRED + BEA
  const metroAll = [
    ...await fetchFredMetroUnemployment(fredStartYear),
    ...await fetchFredMetroEmployment(fredStartYear),
    ...await fetchBeaMetroGdp(),
    ...await fetchBeaMetroRpp(),
  ];
  const metroResult = await upsertWithLogging({
    source: 'census', tableName: ECONOMIC_TABLES.metro.tableName,
    conflictKeys: ECONOMIC_TABLES.metro.conflictKeys,
    datasetId: 'economic-metro', records: mergeByKey(metroAll, 'period_date', 'cbsa_code'),
  });
  totalInserted += metroResult.inserted;
  totalFailed += metroResult.failed;

  // County: BEA GDP + BLS unemployment
  // Source is 'census' (the Census/Economic umbrella) because data merges BEA + BLS
  const countyGdp = await fetchBeaCountyGdp();
  const countyFipsList = [...new Set(countyGdp.map(r => String(r.fips_code)).filter(Boolean))];
  console.log(`  Found ${countyFipsList.length} counties from BEA GDP for BLS fetch`);
  const countyUnemployment = await fetchBlsCountyUnemployment(countyFipsList, fredStartYear);
  const countyResult = await upsertWithLogging({
    source: 'census', tableName: ECONOMIC_TABLES.county.tableName,
    conflictKeys: ECONOMIC_TABLES.county.conflictKeys,
    datasetId: 'economic-county',
    records: mergeByKey([...countyGdp, ...countyUnemployment], 'period_date', 'fips_code'),
  });
  totalInserted += countyResult.inserted;
  totalFailed += countyResult.failed;

  return { inserted: totalInserted, failed: totalFailed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('Census & Economic Unified Data Import');
  console.log('='.repeat(60));
  console.log(`Date:   ${new Date().toISOString()}`);
  console.log(`Mode:   ${quickMode ? 'QUICK (2 years)' : 'FULL HISTORICAL'}`);
  console.log(`Census: ${importCensus ? 'YES' : 'SKIP'}`);
  console.log(`Econ:   ${importEconomic ? 'YES' : 'SKIP'}`);
  console.log('');

  let totalInserted = 0;
  let totalFailed = 0;

  if (importCensus) {
    const census = await importAllCensusData();
    totalInserted += census.inserted;
    totalFailed += census.failed;
  }

  if (importEconomic) {
    const econ = await importAllEconomicData();
    totalInserted += econ.inserted;
    totalFailed += econ.failed;
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('  CENSUS & ECONOMIC IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Total failed:   ${totalFailed}`);
  console.log(`  Duration:       ${duration} minutes`);
  console.log('='.repeat(60));

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
