/**
 * Import Realtor.com ZIP Data
 *
 * Imports ZIP-level housing market data from Realtor.com (core + hotness combined).
 * Uses streaming with backpressure to handle large files (771MB core file).
 *
 * Usage:
 *   npx tsx scripts/import-realtor-zip.ts           # Current month
 *   npx tsx scripts/import-realtor-zip.ts --history # Historical files
 */

import { createReadStream } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse';
import { createRealtorImportClient } from './realtor-import/db-client';
import { loadFromFile } from './realtor-import/download';
import { parseZipHotnessCSV } from './realtor-import/csv-processor';
import { REALTOR_DATASETS, RealtorCombinedRecord } from './realtor-import/types';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';
import { createIngestionLogger } from './utils/ingestion-logger';
import { normalizeZipKey } from './utils/zip';

const DATA_DIR = join(__dirname, '../data/realtor');
const DATASET_CONFIG = REALTOR_DATASETS.find(d => d.id === 'realtor-zip')!;
let BATCH_SIZE = 500;
let LIMIT: number | null = null;

// Parse args
const args = process.argv.slice(2);
const batchArg = args.find(a => a.startsWith('--batch='));
if (batchArg) {
  const val = parseInt(batchArg.split('=')[1]);
  if (!isNaN(val) && val > 0) BATCH_SIZE = val;
}

const limitArg = args.find(a => a.startsWith('--limit='));
if (limitArg) {
  const val = parseInt(limitArg.split('=')[1]);
  if (!isNaN(val) && val > 0) LIMIT = val;
}

const noRefresh = args.includes('--no-refresh');

function parseYYYYMM(yyyymm: string): Date {
  const year = parseInt(yyyymm.substring(0, 4));
  const month = parseInt(yyyymm.substring(4, 6));
  return new Date(year, month - 1, 1);
}

function parseNumeric(value: string | undefined): number | null {
  if (!value || value === '' || value === 'null' || value === 'undefined') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseInteger(value: string | undefined): number | null {
  const num = parseNumeric(value);
  return num !== null ? Math.round(num) : null;
}

function parseRow(row: any, hotnessMap: Map<string, Partial<RealtorCombinedRecord>>): any {
  const periodDate = parseYYYYMM(row.month_date_yyyymm);
  const postalCode = row.postal_code ? normalizeZipKey(String(row.postal_code)) : row.postal_code;

  const record: any = {
    period_date: periodDate,
    postal_code: postalCode,
    zip_name: row.zip_name,
    median_listing_price: parseNumeric(row.median_listing_price),
    median_listing_price_mm: parseNumeric(row.median_listing_price_mm),
    median_listing_price_yy: parseNumeric(row.median_listing_price_yy),
    active_listing_count: parseInteger(row.active_listing_count),
    active_listing_count_mm: parseNumeric(row.active_listing_count_mm),
    active_listing_count_yy: parseNumeric(row.active_listing_count_yy),
    median_days_on_market: parseInteger(row.median_days_on_market),
    median_days_on_market_mm: parseNumeric(row.median_days_on_market_mm),
    median_days_on_market_yy: parseNumeric(row.median_days_on_market_yy),
    new_listing_count: parseInteger(row.new_listing_count),
    new_listing_count_mm: parseNumeric(row.new_listing_count_mm),
    new_listing_count_yy: parseNumeric(row.new_listing_count_yy),
    price_increased_count: parseInteger(row.price_increased_count),
    price_increased_count_mm: parseNumeric(row.price_increased_count_mm),
    price_increased_count_yy: parseNumeric(row.price_increased_count_yy),
    price_increased_share: parseNumeric(row.price_increased_share),
    price_increased_share_mm: parseNumeric(row.price_increased_share_mm),
    price_increased_share_yy: parseNumeric(row.price_increased_share_yy),
    price_reduced_count: parseInteger(row.price_reduced_count),
    price_reduced_count_mm: parseNumeric(row.price_reduced_count_mm),
    price_reduced_count_yy: parseNumeric(row.price_reduced_count_yy),
    price_reduced_share: parseNumeric(row.price_reduced_share),
    price_reduced_share_mm: parseNumeric(row.price_reduced_share_mm),
    price_reduced_share_yy: parseNumeric(row.price_reduced_share_yy),
    pending_listing_count: parseInteger(row.pending_listing_count),
    pending_listing_count_mm: parseNumeric(row.pending_listing_count_mm),
    pending_listing_count_yy: parseNumeric(row.pending_listing_count_yy),
    median_listing_price_per_square_foot: parseNumeric(row.median_listing_price_per_square_foot),
    median_listing_price_per_square_foot_mm: parseNumeric(row.median_listing_price_per_square_foot_mm),
    median_listing_price_per_square_foot_yy: parseNumeric(row.median_listing_price_per_square_foot_yy),
    median_square_feet: parseInteger(row.median_square_feet),
    median_square_feet_mm: parseNumeric(row.median_square_feet_mm),
    median_square_feet_yy: parseNumeric(row.median_square_feet_yy),
    average_listing_price: parseNumeric(row.average_listing_price),
    average_listing_price_mm: parseNumeric(row.average_listing_price_mm),
    average_listing_price_yy: parseNumeric(row.average_listing_price_yy),
    total_listing_count: parseInteger(row.total_listing_count),
    total_listing_count_mm: parseNumeric(row.total_listing_count_mm),
    total_listing_count_yy: parseNumeric(row.total_listing_count_yy),
    pending_ratio: parseNumeric(row.pending_ratio),
    pending_ratio_mm: parseNumeric(row.pending_ratio_mm),
    pending_ratio_yy: parseNumeric(row.pending_ratio_yy),
    quality_flag: parseInteger(row.quality_flag) || 0
  };

  // Merge hotness data if available
  const dateStr = periodDate.getFullYear().toString() +
    (periodDate.getMonth() + 1).toString().padStart(2, '0');
  const hotnessKey = `${dateStr}_${postalCode}`;
  const hotness = hotnessMap.get(hotnessKey);
  if (hotness) {
    Object.assign(record, hotness);
  }

  return record;
}

async function processBatch(supabase: any, records: any[]): Promise<{ inserted: number; errors: number }> {
  if (records.length === 0) return { inserted: 0, errors: 0 };

  const formattedBatch = records.map(record => ({
    ...record,
    period_date: record.period_date.toISOString().split('T')[0]
  }));

  const { error } = await supabase
    .from('realtor_zip')
    .upsert(formattedBatch, {
      onConflict: 'period_date,postal_code',
      ignoreDuplicates: false
    });

  if (error) {
    return { inserted: 0, errors: records.length };
  }
  return { inserted: records.length, errors: 0 };
}

async function streamImportZipCore(
  supabase: any,
  coreFilePath: string,
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>,
  sinceDate?: string | null
): Promise<{ recordsInserted: number; errors: number }> {
  return new Promise((resolve, reject) => {
    let recordsInserted = 0;
    let errors = 0;
    let batch: any[] = [];
    let totalRead = 0;
    let skipped = 0;
    let limitReached = false;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const fileStream = createReadStream(coreFilePath);
    fileStream.pipe(parser);

    (async () => {
      try {
        for await (const row of parser) {
          if (LIMIT && totalRead >= LIMIT) {
            console.log(`\n  🛑 Limit reached (${LIMIT} records). Stopping...`);
            break;
          }

          // Skip records before the since date filter
          if (sinceDate && row.month_date_yyyymm < sinceDate) {
            skipped++;
            continue;
          }

          const record = parseRow(row, hotnessMap);
          batch.push(record);
          totalRead++;

          if (batch.length >= BATCH_SIZE) {
            const batchToProcess = [...batch];
            batch = [];

            const result = await processBatch(supabase, batchToProcess);
            recordsInserted += result.inserted;
            errors += result.errors;

            if (totalRead % 10000 === 0) {
              process.stdout.write(`\r  📊 Progress: ${totalRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted`);
            }
          }
        }

        // Process remaining batch
        if (batch.length > 0) {
          const result = await processBatch(supabase, batch);
          recordsInserted += result.inserted;
          errors += result.errors;
        }

        console.log(`\n  📊 Final: ${totalRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted${skipped > 0 ? `, ${skipped.toLocaleString()} skipped (before filter)` : ''}`);

        fileStream.destroy();
        resolve({ recordsInserted, errors });
      } catch (err) {
        fileStream.destroy();
        reject(err);
      }
    })();
  });
}

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const useHistory = args.includes('--history');
  const sinceArg = args.find(a => a.startsWith('--since='));
  const sinceDate = sinceArg ? sinceArg.split('=')[1] : null; // e.g. --since=202601

  console.log('🏠 Realtor.com ZIP Data Import (Streaming)');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${useHistory ? 'Historical files' : 'Current month download'}`);
  if (sinceDate) console.log(`Filter: Only records >= ${sinceDate}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  const supabase = createRealtorImportClient();

  // Create ingestion logger
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_zip',
    datasetId: 'realtor-zip'
  });

  try {
    // Load hotness data first (smaller file, can fit in memory)
    console.log('📂 Loading hotness data...');
    const hotnessFile = useHistory ? DATASET_CONFIG.hotnessHistoryFile! : DATASET_CONFIG.id.replace('realtor-', 'RDC_Inventory_Hotness_Metrics_Zip.csv');
    let hotnessResult;
    if (useHistory) {
      hotnessResult = loadFromFile(DATASET_CONFIG.hotnessHistoryFile!);
    } else {
      // Download current month hotness
      const { downloadDataset } = await import('./realtor-import/download');
      hotnessResult = await downloadDataset(DATASET_CONFIG.hotnessUrl!);
    }
    if (!hotnessResult.success) {
      console.error(`❌ Failed to load hotness file: ${hotnessResult.error}`);
      await logger.fail(`Failed to load hotness file: ${hotnessResult.error}`);
      process.exit(1);
    }

    console.log('📊 Parsing hotness data...');
    const hotnessMap = parseZipHotnessCSV(hotnessResult.csvContent!);
    console.log(`  ✅ Parsed ${hotnessMap.size.toLocaleString()} hotness records`);

    // Start ingestion log
    await logger.start();

    if (!useHistory) {
      // Current month mode: download and import core data directly
      console.log('\n💾 Downloading and importing current month core data...');
      const { downloadDataset } = await import('./realtor-import/download');
      const coreResult = await downloadDataset(DATASET_CONFIG.downloadUrl);
      if (!coreResult.success) {
        console.error(`❌ Failed to download core data: ${coreResult.error}`);
        await logger.fail(`Failed to download core data: ${coreResult.error}`);
        process.exit(1);
      }

      // Parse the CSV and process records
      const { parse: parseCSV } = await import('csv-parse/sync');
      const rows = parseCSV(coreResult.csvContent!, { columns: true, skip_empty_lines: true, trim: true });
      console.log(`  ✅ Parsed ${rows.length.toLocaleString()} core records`);

      let recordsInserted = 0;
      let errors = 0;
      const records = rows.map((row: any) => parseRow(row, hotnessMap));

      // Import in batches
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const result = await processBatch(supabase, batch);
        recordsInserted += result.inserted;
        errors += result.errors;

        if ((i + BATCH_SIZE) % 10000 < BATCH_SIZE) {
          console.log(`  📊 Progress: ${Math.min(i + BATCH_SIZE, records.length).toLocaleString()}/${records.length.toLocaleString()} records`);
        }
      }

      // Complete ingestion log
      await logger.complete({
        recordsProcessed: records.length,
        recordsSuccess: recordsInserted,
        recordsError: errors,
        errors: errors > 0 ? [`${errors} records failed`] : []
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + '='.repeat(60));
      console.log('📊 IMPORT SUMMARY');
      console.log('='.repeat(60));
      console.log(`Records imported: ${recordsInserted.toLocaleString()}`);
      console.log(`Errors: ${errors}`);
      console.log(`Duration: ${duration}s`);
      console.log('='.repeat(60));

      if (errors === 0) {
        if (recordsInserted > 0) {
          await refreshCalculatedMetrics(supabase);
        }
        console.log('✅ IMPORT COMPLETED SUCCESSFULLY');
      } else {
        console.log('❌ IMPORT COMPLETED WITH ERRORS');
        process.exit(1);
      }
      return;
    }

    // History mode: stream and import from large file
    console.log('\n💾 Streaming and importing core data...');
    const coreFilePath = join(DATA_DIR, DATASET_CONFIG.historyFile!);
    const result = await streamImportZipCore(supabase, coreFilePath, hotnessMap, sinceDate);

    // Complete ingestion log
    await logger.complete({
      recordsProcessed: result.recordsInserted + result.errors,
      recordsSuccess: result.recordsInserted,
      recordsError: result.errors,
      errors: result.errors > 0 ? [`${result.errors} records failed`] : []
    });

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Records imported: ${result.recordsInserted.toLocaleString()}`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(60));

    if (result.errors === 0) {
      // Refresh calculated metrics after successful import
      if (result.recordsInserted > 0 && !noRefresh) {
        await refreshCalculatedMetrics(supabase);
      }
      console.log('✅ IMPORT COMPLETED SUCCESSFULLY');
    } else {
      console.log('❌ IMPORT COMPLETED WITH ERRORS');
      process.exit(1);
    }
  } catch (error: any) {
    await logger.fail(error.message);
    throw error;
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
