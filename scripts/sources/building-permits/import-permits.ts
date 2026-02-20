#!/usr/bin/env npx tsx
/**
 * Building Permits unified data import entry point.
 *
 * Fetches monthly county-level building permits from the Census Bureau
 * BPS archive, computes totals and YoY growth, aggregates to state
 * level, and upserts both county and state tables using the shared
 * import framework (batchUpsert + ingestion logging + status reporting).
 *
 * Like the Census/Economic adapter, this source is API-based and
 * cannot use runSourceImport() directly. Instead it fetches data,
 * transforms it, then calls batchUpsert() for each geography.
 *
 * Usage:
 *   npx tsx scripts/sources/building-permits/import-permits.ts
 *   npx tsx scripts/sources/building-permits/import-permits.ts --geo=county
 *   npx tsx scripts/sources/building-permits/import-permits.ts --geo=state
 *   npx tsx scripts/sources/building-permits/import-permits.ts --start-year=2020
 *   npx tsx scripts/sources/building-permits/import-permits.ts --year=2024
 */

import { getSupabaseClient, batchUpsert } from '../../lib';
import type { BatchUpsertResult } from '../../lib';
import { createIngestionLogger } from '../../utils/ingestion-logger';
import type { IngestionSource } from '../../utils/ingestion-logger';
import { printSummaryBanner, reportStatusToBackend } from '../../lib/import-reporter';
import type { ImportSourceResult, ImportGeographyResult } from '../../lib';

import { PERMITS_TABLES, DEFAULT_START_YEAR, getDefaultEndYear } from './permits-config';
import {
  fetchAllCountyPermits,
  computeYearOverYear,
  aggregateCountyToState,
} from './permits-api-client';
import type { PermitCountyRecord, PermitStateRecord } from './permits-api-client';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getCliArg(prefix: string): string | null {
  const match = args.find(a => a.startsWith(prefix));
  return match ? match.split('=')[1] : null;
}

const geoFilter = getCliArg('--geo=')?.toLowerCase() ?? null;
const singleYear = getCliArg('--year=') ? parseInt(getCliArg('--year=')!, 10) : null;
const cliStartYear = getCliArg('--start-year=') ? parseInt(getCliArg('--start-year=')!, 10) : null;
const cliEndYear = getCliArg('--end-year=') ? parseInt(getCliArg('--end-year=')!, 10) : null;

const startYear = singleYear ?? cliStartYear ?? DEFAULT_START_YEAR;
const endYear = singleYear ?? cliEndYear ?? getDefaultEndYear();

const SOURCE: IngestionSource = 'permits';
const BATCH_SIZE = 5000;

// ---------------------------------------------------------------------------
// Upsert helper with ingestion logging
// ---------------------------------------------------------------------------

async function upsertPermitsWithLogging(
  geoId: string,
  records: Record<string, unknown>[],
): Promise<ImportGeographyResult> {
  const startTime = Date.now();
  const tableConfig = PERMITS_TABLES[geoId];
  const supabase = getSupabaseClient();

  const result: ImportGeographyResult = {
    geographyId: geoId,
    tableName: tableConfig.tableName,
    status: 'failed',
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: records.length,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  const logger = createIngestionLogger(supabase, {
    source: SOURCE,
    tableName: tableConfig.tableName,
    datasetId: `permits-${geoId}`,
  });

  try {
    console.log(`\n--- Upserting ${records.length} records into ${tableConfig.tableName} ---`);

    if (records.length === 0) {
      console.log('  No records to upsert, skipping.');
      result.status = 'skipped';
      result.durationMs = Date.now() - startTime;
      return result;
    }

    await logger.start(records.length);

    const upsertResult: BatchUpsertResult = await batchUpsert(supabase, records, {
      tableName: tableConfig.tableName,
      conflictKeys: tableConfig.conflictKeys,
      batchSize: BATCH_SIZE,
    });

    result.recordsInserted = upsertResult.inserted;
    result.recordsFailed = upsertResult.failed;
    result.errors = upsertResult.errors;

    // Find latest period_date
    for (const record of records) {
      const pd = record.period_date as string;
      if (pd && pd > (result.latestPeriodDate || '')) {
        result.latestPeriodDate = pd;
      }
    }

    // Determine status
    if (result.recordsFailed === 0 && result.recordsInserted > 0) {
      result.status = 'success';
    } else if (result.recordsInserted > 0 && result.recordsFailed > 0) {
      result.status = 'partial';
    }

    await logger.complete({
      recordsProcessed: records.length,
      recordsSuccess: result.recordsInserted,
      recordsError: result.recordsFailed,
      errors: result.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    console.error(`  FATAL error upserting ${geoId}: ${message}`);
    await logger.fail(message);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const overallStart = Date.now();

  console.log('Building Permits Unified Data Import');
  console.log('='.repeat(60));
  console.log(`Date:       ${new Date().toISOString()}`);
  console.log(`Years:      ${startYear} to ${endYear}`);
  console.log(`Geo filter: ${geoFilter ?? 'all (county + state)'}`);
  console.log('');

  // Step 1: Fetch all county data from Census BPS
  console.log('Step 1: Fetching county permits from Census BPS...');
  const countyRecords: PermitCountyRecord[] = await fetchAllCountyPermits(startYear, endYear);
  console.log(`\nFetched ${countyRecords.length} total county records`);

  if (countyRecords.length === 0) {
    console.log('No records fetched. Exiting.');
    process.exit(0);
  }

  // Step 2: Compute year-over-year for county records
  console.log('\nStep 2: Computing year-over-year growth for counties...');
  computeYearOverYear(countyRecords, 'fips_code');

  // Step 3: Aggregate to state level
  console.log('Step 3: Aggregating county data to state level...');
  const stateRecords: PermitStateRecord[] = aggregateCountyToState(countyRecords);
  console.log(`  Generated ${stateRecords.length} state records`);

  // Step 4: Upsert each geography
  const geoResults: ImportGeographyResult[] = [];

  if (!geoFilter || geoFilter === 'county') {
    const countyResult = await upsertPermitsWithLogging('county', countyRecords);
    geoResults.push(countyResult);
  }

  if (!geoFilter || geoFilter === 'state') {
    const stateResult = await upsertPermitsWithLogging('state', stateRecords);
    geoResults.push(stateResult);
  }

  // Step 5: Build aggregated result and report
  const totalInserted = geoResults.reduce((sum, g) => sum + g.recordsInserted, 0);
  const totalFailed = geoResults.reduce((sum, g) => sum + g.recordsFailed, 0);
  const allSucceeded = geoResults.every(g => g.status === 'success' || g.status === 'skipped');
  const anySucceeded = geoResults.some(g => g.status === 'success' || g.status === 'partial');

  let overallStatus: 'success' | 'partial' | 'failed';
  if (allSucceeded) {
    overallStatus = 'success';
  } else if (anySucceeded) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'failed';
  }

  const sourceResult: ImportSourceResult = {
    source: SOURCE,
    geographies: geoResults,
    overallStatus,
    totalInserted,
    totalFailed,
    totalDurationMs: Date.now() - overallStart,
  };

  printSummaryBanner(sourceResult);
  await reportStatusToBackend(sourceResult);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
