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

const DATA_DIR = join(__dirname, '../data/realtor');
const DATASET_CONFIG = REALTOR_DATASETS.find(d => d.id === 'realtor-zip')!;
const BATCH_SIZE = 500;

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
  const postalCode = row.postal_code;

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

  const { error, data } = await supabase
    .from('realtor_zip')
    .upsert(formattedBatch, {
      onConflict: 'period_date,postal_code',
      ignoreDuplicates: false
    })
    .select();

  if (error) {
    return { inserted: 0, errors: records.length };
  }
  return { inserted: data?.length || 0, errors: 0 };
}

async function streamImportZipCore(
  supabase: any,
  coreFilePath: string,
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>
): Promise<{ recordsInserted: number; errors: number }> {
  return new Promise((resolve, reject) => {
    let recordsInserted = 0;
    let errors = 0;
    let batch: any[] = [];
    let totalRead = 0;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const fileStream = createReadStream(coreFilePath);

    parser.on('data', async (row) => {
      const record = parseRow(row, hotnessMap);
      batch.push(record);
      totalRead++;

      if (batch.length >= BATCH_SIZE) {
        // Pause stream while processing batch
        parser.pause();
        fileStream.pause();

        const batchToProcess = [...batch];
        batch = [];

        const result = await processBatch(supabase, batchToProcess);
        recordsInserted += result.inserted;
        errors += result.errors;

        if (totalRead % 50000 === 0) {
          console.log(`  📊 Progress: ${totalRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted`);
        }

        // Resume stream
        parser.resume();
        fileStream.resume();
      }
    });

    parser.on('end', async () => {
      // Process remaining batch
      if (batch.length > 0) {
        const result = await processBatch(supabase, batch);
        recordsInserted += result.inserted;
        errors += result.errors;
      }

      console.log(`  📊 Final: ${totalRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted`);
      resolve({ recordsInserted, errors });
    });

    parser.on('error', (err) => {
      reject(err);
    });

    fileStream.pipe(parser);
  });
}

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const useHistory = args.includes('--history');

  console.log('🏠 Realtor.com ZIP Data Import (Streaming)');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${useHistory ? 'Historical files' : 'Current month download'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  const supabase = createRealtorImportClient();

  // Load hotness data first (smaller file, can fit in memory)
  console.log('📂 Loading hotness data...');
  const hotnessResult = loadFromFile(DATASET_CONFIG.hotnessHistoryFile!);
  if (!hotnessResult.success) {
    console.error(`❌ Failed to load hotness file: ${hotnessResult.error}`);
    process.exit(1);
  }

  console.log('📊 Parsing hotness data...');
  const hotnessMap = parseZipHotnessCSV(hotnessResult.csvContent!);
  console.log(`  ✅ Parsed ${hotnessMap.size.toLocaleString()} hotness records`);

  // Stream and import core data
  console.log('\n💾 Streaming and importing core data...');
  const coreFilePath = join(DATA_DIR, DATASET_CONFIG.historyFile!);
  const result = await streamImportZipCore(supabase, coreFilePath, hotnessMap);

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
    console.log('✅ IMPORT COMPLETED SUCCESSFULLY');
  } else {
    console.log('❌ IMPORT COMPLETED WITH ERRORS');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
