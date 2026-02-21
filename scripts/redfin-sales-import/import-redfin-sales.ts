/**
 * Redfin S3 Market Tracker Sales Import Pipeline
 *
 * Downloads gzipped TSV files from Redfin's public S3 bucket, parses them,
 * and upserts into per-geography Supabase tables (redfin_national through
 * redfin_neighborhood).
 *
 * Small files (national, state, metro): loaded entirely into memory.
 * Large files (county, city, zip, neighborhood): streamed and batch-processed.
 *
 * Usage:
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=metro
 *   npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=zip --limit=1000
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { downloadAndDecompress, downloadToDiskThenStream, needsStreaming } from './download';
import { parseTsv, parseTsvStream } from './parser';
import { loadEnv, createSupabaseAdminClient, testConnection, upsertBatch, BATCH_SIZE } from './db-client';
import type { RedfinS3Dataset, RedfinGeoLevel, ImportResult, RedfinSalesRecord } from './types';
import { REDFIN_S3_DATASETS } from './types';

// ---------------------------------------------------------------------------
// Single dataset import (in-memory mode for small files)
// ---------------------------------------------------------------------------

async function importDatasetInMemory(
  supabase: SupabaseClient,
  dataset: RedfinS3Dataset,
  rowLimit?: number,
): Promise<ImportResult> {
  const startTime = Date.now();
  const result: ImportResult = {
    geoLevel: dataset.geoLevel,
    tableName: dataset.tableName,
    totalRows: 0,
    inserted: 0,
    errors: 0,
    durationMs: 0,
  };

  try {
    let tsv = await downloadAndDecompress(dataset);
    let records = parseTsv(tsv, dataset.geoLevel);
    tsv = '';
    if (global.gc) global.gc();
    result.totalRows = records.length;

    if (rowLimit && records.length > rowLimit) {
      console.log(`    Limiting to ${rowLimit} rows (from ${records.length})`);
      records = records.slice(0, rowLimit);
    }

    if (records.length === 0) {
      console.log(`    No records to insert for ${dataset.geoLevel}`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    console.log(`    Upserting ${records.length} records in ${totalBatches} batches into ${dataset.tableName}...`);

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batchResult = await upsertBatch(supabase, dataset.tableName, batch, batchNum, totalBatches);
      result.inserted += batchResult.inserted;
      result.errors += batchResult.errors;
    }
  } catch (error: any) {
    console.error(`    Fatal error importing ${dataset.geoLevel}: ${error.message}`);
    result.errors++;
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Single dataset import (streaming mode for large files)
// ---------------------------------------------------------------------------

async function importDatasetStreaming(
  supabase: SupabaseClient,
  dataset: RedfinS3Dataset,
  rowLimit?: number,
): Promise<ImportResult> {
  const startTime = Date.now();
  const result: ImportResult = {
    geoLevel: dataset.geoLevel,
    tableName: dataset.tableName,
    totalRows: 0,
    inserted: 0,
    errors: 0,
    durationMs: 0,
  };

  let cleanup = () => {};
  try {
    // Phase 1: Download compressed file to disk (decouples S3 from processing)
    const downloaded = await downloadToDiskThenStream(dataset);
    cleanup = downloaded.cleanup;
    const stream = downloaded.stream;

    // Phase 2: Stream-parse from disk and upsert each batch immediately
    // Never holds more than BATCH_SIZE records in memory at a time
    console.log(`    Stream-parsing from disk + upserting (batch size: ${BATCH_SIZE})...`);

    let batchNum = 0;
    let limitReached = false;

    for await (const { batch, rawCount, filteredCount } of parseTsvStream(stream, dataset.geoLevel, BATCH_SIZE)) {
      batchNum++;
      result.totalRows = filteredCount;

      let recordsToInsert = batch;
      if (rowLimit && result.inserted + batch.length > rowLimit) {
        const remaining = rowLimit - result.inserted;
        if (remaining <= 0) break;
        recordsToInsert = batch.slice(0, remaining);
        limitReached = true;
      }

      const batchResult = await upsertBatch(supabase, dataset.tableName, recordsToInsert, batchNum, -1);
      result.inserted += batchResult.inserted;
      result.errors += batchResult.errors;

      if (limitReached) {
        console.log(`    Row limit ${rowLimit} reached after ${batchNum} batches`);
        break;
      }
    }

    console.log(`    Complete: ${result.totalRows.toLocaleString()} rows parsed, ${result.inserted.toLocaleString()} inserted, ${batchNum} batches`);
  } catch (error: any) {
    console.error(`    Fatal error importing ${dataset.geoLevel}: ${error.message}`);
    result.errors++;
  } finally {
    cleanup();
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ---------------------------------------------------------------------------
// Unified dataset import (picks mode automatically)
// ---------------------------------------------------------------------------

async function importDataset(
  supabase: SupabaseClient,
  dataset: RedfinS3Dataset,
  rowLimit?: number,
): Promise<ImportResult> {
  if (needsStreaming(dataset.geoLevel)) {
    return importDatasetStreaming(supabase, dataset, rowLimit);
  }
  return importDatasetInMemory(supabase, dataset, rowLimit);
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOptions {
  geoFilter?: RedfinGeoLevel;
  rowLimit?: number;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--geo=')) {
      const value = arg.split('=')[1] as RedfinGeoLevel;
      const validLevels: RedfinGeoLevel[] = ['national', 'state', 'metro', 'county', 'city', 'zip', 'neighborhood'];
      if (!validLevels.includes(value)) {
        console.error(`Invalid --geo value: ${value}. Valid options: ${validLevels.join(', ')}`);
        process.exit(1);
      }
      options.geoFilter = value;
    } else if (arg.startsWith('--limit=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (isNaN(value) || value <= 0) {
        console.error(`Invalid --limit value: ${arg.split('=')[1]}. Must be a positive integer.`);
        process.exit(1);
      }
      options.rowLimit = value;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Redfin S3 Market Tracker Sales Import

Usage:
  npx tsx scripts/redfin-sales-import/import-redfin-sales.ts [options]

Options:
  --geo=<level>    Import only one geography level
                   Valid: national, state, metro, county, city, zip, neighborhood
  --limit=<N>      Limit rows per dataset (for testing)
  --help, -h       Show this help message
`);
      process.exit(0);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('  Redfin S3 Market Tracker Sales Import');
  console.log('='.repeat(70));

  // 1. Load env and parse CLI
  loadEnv();
  const options = parseCliArgs();

  if (options.geoFilter) {
    console.log(`  Geo filter: ${options.geoFilter}`);
  }
  if (options.rowLimit) {
    console.log(`  Row limit: ${options.rowLimit}`);
  }

  // 2. Create Supabase client
  const supabase = createSupabaseAdminClient();

  // 3. Test connection
  const connected = await testConnection(supabase);
  if (!connected) {
    console.error('  Aborting: database connection failed.');
    process.exit(1);
  }

  // 4. Determine which datasets to import
  let datasets = REDFIN_S3_DATASETS;
  if (options.geoFilter) {
    datasets = datasets.filter(d => d.geoLevel === options.geoFilter);
  }

  console.log(`\n  Importing ${datasets.length} dataset(s)\n`);

  // 5. Import each dataset sequentially
  const results: ImportResult[] = [];

  for (const [index, dataset] of datasets.entries()) {
    console.log(`\n[${index + 1}/${datasets.length}] ${dataset.geoLevel.toUpperCase()} -> ${dataset.tableName}`);
    console.log('-'.repeat(50));

    const result = await importDataset(supabase, dataset, options.rowLimit);
    results.push(result);

    console.log(`  Done: ${result.inserted.toLocaleString()} inserted, ${result.errors} errors, ${(result.durationMs / 1000).toFixed(1)}s`);

    // Brief pause between datasets to avoid overwhelming the API
    if (index < datasets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 6. Print summary
  console.log('\n' + '='.repeat(70));
  console.log('  Import Summary');
  console.log('='.repeat(70));
  console.log('');

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  for (const result of results) {
    const status = result.errors > 0 ? 'ERRORS' : 'OK';
    console.log(
      `  ${result.geoLevel.padEnd(14)} | ${result.tableName.padEnd(22)} | ` +
      `${result.totalRows.toLocaleString().padStart(10)} rows | ` +
      `${result.inserted.toLocaleString().padStart(10)} inserted | ` +
      `${(result.durationMs / 1000).toFixed(1).padStart(6)}s | ${status}`
    );
  }

  console.log('');
  console.log(`  Total: ${totalInserted.toLocaleString()} inserted, ${totalErrors} errors, ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('='.repeat(70));

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
