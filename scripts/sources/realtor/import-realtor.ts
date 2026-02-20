#!/usr/bin/env npx tsx
/**
 * Realtor.com unified data import entry point.
 *
 * Imports all 5 geography levels: national, state, metro, county, zip.
 * National and state use the shared runSourceImport() directly.
 * Metro, county, and zip require merging core + hotness CSVs before upserting.
 *
 * Usage:
 *   npx tsx scripts/sources/realtor/import-realtor.ts              # Download current month
 *   npx tsx scripts/sources/realtor/import-realtor.ts --history    # Load from local history files
 *   npx tsx scripts/sources/realtor/import-realtor.ts --geo metro  # Single geography only
 */

import {
  getSupabaseClient,
  loadDataFile,
  batchUpsert,
  runSourceImport,
} from '../../lib';
import type { ImportSourceResult, BatchUpsertResult } from '../../lib';
import { refreshCalculatedMetrics } from '../../utils/refresh-calculated-metrics';
import { createIngestionLogger } from '../../utils/ingestion-logger';
import {
  buildNationalStateConfig,
  buildHotnessMap,
  mergeCoreAndHotness,
  mapMetroCoreRow,
  mapCountyCoreRow,
  mapZipCoreRow,
  REALTOR_URLS,
  REALTOR_HISTORY_FILES,
  REALTOR_TABLES,
} from './realtor-config';
import type { ColumnMapFn } from '../../lib';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const useHistory = args.includes('--history');
const geoFilter = args.includes('--geo') ? args[args.indexOf('--geo') + 1] : null;

// ---------------------------------------------------------------------------
// Combined geography configuration for core+hotness merge levels
// ---------------------------------------------------------------------------

interface MergeGeographySpec {
  id: string;
  tableName: string;
  conflictKeys: string[];
  coreUrl: string;
  hotnessUrl: string;
  coreLocalPath?: string;
  hotnessLocalPath?: string;
  coreColumnMap: ColumnMapFn;
  regionKeyField: string;
  hotnessIncludesExtras: boolean;
  datasetId: string;
}

const MERGE_GEOGRAPHIES: MergeGeographySpec[] = [
  {
    id: 'metro',
    ...REALTOR_TABLES.metro,
    coreUrl: REALTOR_URLS.metro.core,
    hotnessUrl: REALTOR_URLS.metro.hotness,
    coreLocalPath: REALTOR_HISTORY_FILES.metro.core,
    hotnessLocalPath: REALTOR_HISTORY_FILES.metro.hotness,
    coreColumnMap: mapMetroCoreRow,
    regionKeyField: 'cbsa_code',
    hotnessIncludesExtras: false,
    datasetId: 'realtor-metro',
  },
  {
    id: 'county',
    ...REALTOR_TABLES.county,
    coreUrl: REALTOR_URLS.county.core,
    hotnessUrl: REALTOR_URLS.county.hotness,
    coreLocalPath: REALTOR_HISTORY_FILES.county.core,
    hotnessLocalPath: REALTOR_HISTORY_FILES.county.hotness,
    coreColumnMap: mapCountyCoreRow,
    regionKeyField: 'county_fips',
    hotnessIncludesExtras: true,
    datasetId: 'realtor-county',
  },
  {
    id: 'zip',
    ...REALTOR_TABLES.zip,
    coreUrl: REALTOR_URLS.zip.core,
    hotnessUrl: REALTOR_URLS.zip.hotness,
    coreLocalPath: REALTOR_HISTORY_FILES.zip.core,
    hotnessLocalPath: REALTOR_HISTORY_FILES.zip.hotness,
    coreColumnMap: mapZipCoreRow,
    regionKeyField: 'postal_code',
    hotnessIncludesExtras: true,
    datasetId: 'realtor-zip',
  },
];

// ---------------------------------------------------------------------------
// Import a single merge geography (core + hotness -> merge -> upsert)
// ---------------------------------------------------------------------------

async function importMergeGeography(spec: MergeGeographySpec): Promise<{
  id: string;
  inserted: number;
  failed: number;
  errors: string[];
}> {
  const supabase = getSupabaseClient();
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: spec.tableName,
    datasetId: spec.datasetId,
  });

  console.log(`\n--- Importing realtor / ${spec.id} -> ${spec.tableName} (core+hotness merge) ---`);

  try {
    await logger.start(0);

    // Load core CSV
    const coreData = await loadDataFile({
      url: spec.coreUrl,
      localPath: useHistory ? spec.coreLocalPath : undefined,
      format: 'csv',
    });
    console.log(`  Core rows loaded: ${coreData.rowCount}`);

    // Load hotness CSV
    const hotnessData = await loadDataFile({
      url: spec.hotnessUrl,
      localPath: useHistory ? spec.hotnessLocalPath : undefined,
      format: 'csv',
    });
    console.log(`  Hotness rows loaded: ${hotnessData.rowCount}`);

    // Map core rows through column mapping (filter out nulls)
    const coreRecords: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const row of coreData.rows) {
      const mapped = spec.coreColumnMap(row);
      if (mapped !== null) {
        coreRecords.push(mapped);
      } else {
        skipped++;
      }
    }
    console.log(`  Core records mapped: ${coreRecords.length} (${skipped} skipped)`);

    // Build hotness lookup map from raw rows
    const hotnessMap = buildHotnessMap(
      hotnessData.rows,
      spec.regionKeyField,
      spec.hotnessIncludesExtras,
    );
    console.log(`  Hotness map entries: ${hotnessMap.size}`);

    // Merge hotness into core records
    const mergedRecords = mergeCoreAndHotness(coreRecords, hotnessMap, spec.regionKeyField);
    console.log(`  Merged records: ${mergedRecords.length}`);

    if (mergedRecords.length === 0) {
      console.log('  No records to import, skipping.');
      return { id: spec.id, inserted: 0, failed: 0, errors: [] };
    }

    // Batch upsert merged records
    const upsertResult: BatchUpsertResult = await batchUpsert(supabase, mergedRecords, {
      tableName: spec.tableName,
      conflictKeys: [...spec.conflictKeys],
      batchSize: 5000,
    });

    await logger.complete({
      recordsProcessed: mergedRecords.length,
      recordsSuccess: upsertResult.inserted,
      recordsError: upsertResult.failed,
      errors: upsertResult.errors,
    });

    return {
      id: spec.id,
      inserted: upsertResult.inserted,
      failed: upsertResult.failed,
      errors: upsertResult.errors,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  FATAL error importing ${spec.id}: ${message}`);
    await logger.fail(message);
    return { id: spec.id, inserted: 0, failed: 0, errors: [message] };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('Realtor.com Unified Data Import');
  console.log('='.repeat(60));
  console.log(`Date:    ${new Date().toISOString()}`);
  console.log(`Mode:    ${useHistory ? 'Local history files' : 'Download current month'}`);
  console.log(`Filter:  ${geoFilter || 'all geographies'}`);
  console.log('');

  let totalInserted = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  // Phase 1: National + State (no merge needed, use runSourceImport)
  const simpleGeos = ['national', 'state'];
  const shouldRunSimple = !geoFilter || simpleGeos.includes(geoFilter);

  if (shouldRunSimple) {
    const config = buildNationalStateConfig(useHistory);

    // If filtering to one geography, remove the other
    if (geoFilter) {
      config.geographies = config.geographies.filter((g) => g.id === geoFilter);
    }

    if (config.geographies.length > 0) {
      const result: ImportSourceResult = await runSourceImport(config);
      totalInserted += result.totalInserted;
      totalFailed += result.totalFailed;
      for (const geo of result.geographies) {
        allErrors.push(...geo.errors);
      }
    }
  }

  // Phase 2: Metro + County + Zip (core+hotness merge)
  const mergeGeos = geoFilter
    ? MERGE_GEOGRAPHIES.filter((g) => g.id === geoFilter)
    : MERGE_GEOGRAPHIES;

  for (const spec of mergeGeos) {
    const result = await importMergeGeography(spec);
    totalInserted += result.inserted;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
  }

  // Phase 3: Post-import hooks (refresh calculated metrics)
  if (!geoFilter) {
    console.log('\nRefreshing calculated metrics...');
    const supabase = getSupabaseClient();
    await refreshCalculatedMetrics(supabase);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('  REALTOR.COM IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Total inserted: ${totalInserted}`);
  console.log(`  Total failed:   ${totalFailed}`);
  console.log(`  Duration:       ${duration}s`);
  if (allErrors.length > 0) {
    console.log(`  Errors (${allErrors.length}):`);
    allErrors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
  console.log('='.repeat(60));

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
