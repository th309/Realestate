/**
 * Import runner orchestrator for the unified data pipeline.
 *
 * Iterates over geographies in an ImportSourceConfig, loading data files,
 * mapping columns, batch upserting, logging to the ingestion table,
 * and reporting status to the backend API.
 *
 * Usage:
 *   const result = await runSourceImport(mySourceConfig);
 */

import type {
  ImportSourceConfig,
  ImportGeographyResult,
  ImportSourceResult,
  GeographyConfig,
} from './types';
import { getSupabaseClient } from './db-client';
import { loadDataFile } from './csv-loader';
import { batchUpsert } from './batch-upsert';
import { createIngestionLogger, IngestionLogger } from '../utils/ingestion-logger';
import { printSummaryBanner, reportStatusToBackend } from './import-reporter';

/**
 * Import a single geography level: load data, map columns, upsert, log.
 */
async function importSingleGeography(
  geoConfig: GeographyConfig,
  sourceConfig: ImportSourceConfig,
): Promise<ImportGeographyResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  const result: ImportGeographyResult = {
    geographyId: geoConfig.id,
    tableName: geoConfig.tableName,
    status: 'failed',
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: 0,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  const logger: IngestionLogger = createIngestionLogger(supabase, {
    source: sourceConfig.source,
    tableName: geoConfig.tableName,
    metricName: geoConfig.metricName,
    datasetId: geoConfig.datasetId,
  });

  try {
    console.log(`\n--- Importing ${sourceConfig.source} / ${geoConfig.id} -> ${geoConfig.tableName} ---`);

    // Step 1: Load data file
    const loadResult = await loadDataFile({
      url: geoConfig.downloadUrl,
      localPath: geoConfig.localPath,
      format: sourceConfig.fileFormat,
    });
    result.totalRowsLoaded = loadResult.rowCount;

    if (loadResult.rowCount === 0) {
      console.log('  No rows loaded, skipping.');
      result.status = 'skipped';
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Step 2: Map columns (filter out nulls = skipped rows)
    const mappedRecords: Record<string, unknown>[] = [];
    for (const row of loadResult.rows) {
      const mapped = geoConfig.columnMap(row);
      if (mapped !== null) {
        mappedRecords.push(mapped);
      } else {
        result.rowsSkippedByMapping++;
      }
    }

    console.log(`  Mapped ${mappedRecords.length} records (${result.rowsSkippedByMapping} skipped)`);

    if (mappedRecords.length === 0) {
      console.log('  No valid records after mapping, skipping.');
      result.status = 'skipped';
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Step 3: Start ingestion log
    await logger.start(mappedRecords.length);

    // Step 4: Batch upsert
    const upsertResult = await batchUpsert(supabase, mappedRecords, {
      tableName: geoConfig.tableName,
      conflictKeys: geoConfig.conflictKeys,
      batchSize: sourceConfig.batchSize,
      onProgress: (inserted, failed) => {
        logger.updateProgress(inserted, failed);
      },
    });

    result.recordsInserted = upsertResult.inserted;
    result.recordsFailed = upsertResult.failed;
    result.errors = upsertResult.errors;

    // Step 5: Determine latest period date
    result.latestPeriodDate = findLatestPeriodDate(mappedRecords);

    // Step 6: Determine status
    if (result.recordsFailed === 0 && result.recordsInserted > 0) {
      result.status = 'success';
    } else if (result.recordsInserted > 0 && result.recordsFailed > 0) {
      result.status = 'partial';
    } else {
      result.status = 'failed';
    }

    // Step 7: Complete ingestion log
    await logger.complete({
      recordsProcessed: mappedRecords.length,
      recordsSuccess: result.recordsInserted,
      recordsError: result.recordsFailed,
      errors: result.errors,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    result.status = 'failed';
    console.error(`  FATAL error importing ${geoConfig.id}: ${message}`);
    await logger.fail(message);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Find the most recent period_date value across a set of mapped records.
 */
function findLatestPeriodDate(records: Record<string, unknown>[]): string | null {
  let latest: string | null = null;
  for (const record of records) {
    const periodDate = record.period_date;
    if (typeof periodDate === 'string' && periodDate > (latest || '')) {
      latest = periodDate;
    }
  }
  return latest;
}

/**
 * Run a full source import: iterate all geographies, upsert data,
 * log progress, and report status.
 *
 * This is the main entry point for source adapters.
 */
export async function runSourceImport(config: ImportSourceConfig): Promise<ImportSourceResult> {
  const overallStart = Date.now();

  console.log(`\nStarting import for source: ${config.source}`);
  console.log(`  Geographies: ${config.geographies.map(g => g.id).join(', ')}`);
  console.log(`  File format: ${config.fileFormat}`);
  console.log(`  Batch size: ${config.batchSize}`);

  const geoResults: ImportGeographyResult[] = [];

  // Import each geography sequentially (to avoid overwhelming the database)
  for (const geoConfig of config.geographies) {
    const geoResult = await importSingleGeography(geoConfig, config);
    geoResults.push(geoResult);
  }

  // Run post-import hooks
  if (config.postImportHooks && config.postImportHooks.length > 0) {
    console.log(`\nRunning ${config.postImportHooks.length} post-import hook(s)...`);
    for (const hook of config.postImportHooks) {
      try {
        await hook();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`  Post-import hook failed: ${message}`);
      }
    }
  }

  // Aggregate results
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
    source: config.source,
    geographies: geoResults,
    overallStatus,
    totalInserted,
    totalFailed,
    totalDurationMs: Date.now() - overallStart,
  };

  printSummaryBanner(sourceResult);
  await reportStatusToBackend(sourceResult);

  return sourceResult;
}
