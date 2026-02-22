/**
 * Import Realtor.com Data (Unified)
 *
 * Imports Realtor.com housing market data across all geography levels.
 * Consolidates the individual import-realtor-{geo}.ts scripts into one entry point.
 *
 * Usage:
 *   # Import all geographies
 *   npx tsx scripts/import-realtor-data.ts
 *
 *   # Import specific geographies
 *   npx tsx scripts/import-realtor-data.ts --geo=national
 *   npx tsx scripts/import-realtor-data.ts --geo=state --geo=metro
 *
 *   # Import from historical files
 *   npx tsx scripts/import-realtor-data.ts --history
 *
 *   # ZIP-specific options
 *   npx tsx scripts/import-realtor-data.ts --geo=zip --batch=500 --since=202601
 */

import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse';
import { createRealtorImportClient } from './realtor-import/db-client';
import { downloadDataset, loadFromFile } from './realtor-import/download';
import {
  parseNationalCSV, importNationalRecords,
  parseStateCSV, importStateRecords,
  parseMetroCoreCSV, parseMetroHotnessCSV, mergeMetroData, importMetroRecords,
  parseCountyCoreCSV, parseCountyHotnessCSV, mergeCountyData, importCountyRecords,
  parseZipHotnessCSV,
} from './realtor-import/csv-processor';
import { REALTOR_DATASETS, RealtorCombinedRecord } from './realtor-import/types';
import type { ImportResult } from './realtor-import/types';
import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';
import { createIngestionLogger } from './utils/ingestion-logger';
import { normalizeZipKey } from './utils/zip';

const DATA_DIR = join(process.cwd(), 'data/realtor');

// ────────────────────────────────────────────────────────────────────────────
// ZIP streaming helpers (extracted from import-realtor-zip.ts)
// ────────────────────────────────────────────────────────────────────────────

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

function parseZipRow(row: any, hotnessMap: Map<string, Partial<RealtorCombinedRecord>>): any {
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
    quality_flag: parseInteger(row.quality_flag) || 0,
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

async function processZipBatch(
  supabase: any,
  records: any[],
): Promise<{ inserted: number; errors: number }> {
  if (records.length === 0) return { inserted: 0, errors: 0 };

  const formattedBatch = records.map(record => ({
    ...record,
    period_date: record.period_date.toISOString().split('T')[0],
  }));

  const { error } = await supabase
    .from('realtor_zip')
    .upsert(formattedBatch, {
      onConflict: 'period_date,postal_code',
      ignoreDuplicates: false,
    });

  if (error) return { inserted: 0, errors: records.length };
  return { inserted: records.length, errors: 0 };
}

async function streamImportZipCore(
  supabase: any,
  coreFilePath: string,
  hotnessMap: Map<string, Partial<RealtorCombinedRecord>>,
  batchSize: number,
  limit: number | null,
  sinceDate: string | null,
): Promise<{ recordsInserted: number; errors: number }> {
  return new Promise((resolve, reject) => {
    let recordsInserted = 0;
    let errors = 0;
    let batch: any[] = [];
    let totalRead = 0;
    let skipped = 0;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const fileStream = createReadStream(coreFilePath);
    fileStream.pipe(parser);

    (async () => {
      try {
        for await (const row of parser) {
          if (limit && totalRead >= limit) {
            console.log(`\n  Limit reached (${limit} records). Stopping...`);
            break;
          }

          if (sinceDate && row.month_date_yyyymm < sinceDate) {
            skipped++;
            continue;
          }

          const record = parseZipRow(row, hotnessMap);
          batch.push(record);
          totalRead++;

          if (batch.length >= batchSize) {
            const batchToProcess = [...batch];
            batch = [];

            const result = await processZipBatch(supabase, batchToProcess);
            recordsInserted += result.inserted;
            errors += result.errors;

            if (totalRead % 10000 === 0) {
              process.stdout.write(`\r  Progress: ${totalRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted`);
            }
          }
        }

        // Process remaining batch
        if (batch.length > 0) {
          const result = await processZipBatch(supabase, batch);
          recordsInserted += result.inserted;
          errors += result.errors;
        }

        console.log(`\n  Final: ${totalRead.toLocaleString()} read, ${recordsInserted.toLocaleString()} inserted${skipped > 0 ? `, ${skipped.toLocaleString()} skipped (before filter)` : ''}`);

        fileStream.destroy();
        resolve({ recordsInserted, errors });
      } catch (err) {
        fileStream.destroy();
        reject(err);
      }
    })();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Geography-level import functions
// ────────────────────────────────────────────────────────────────────────────

async function importNational(
  supabase: any,
  useHistory: boolean,
): Promise<ImportResult> {
  const config = REALTOR_DATASETS.find(d => d.id === 'realtor-national')!;
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_national',
    datasetId: 'realtor-national',
  });

  let csvContent: string;
  if (useHistory && config.historyFile) {
    const result = loadFromFile(config.historyFile);
    if (!result.success) {
      await logger.fail(`Failed to load file: ${result.error}`);
      return { datasetId: 'national', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
    }
    csvContent = result.csvContent!;
  } else {
    const result = await downloadDataset(config.downloadUrl);
    if (!result.success) {
      await logger.fail(`Failed to download: ${result.error}`);
      return { datasetId: 'national', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
    }
    csvContent = result.csvContent!;
  }

  const records = parseNationalCSV(csvContent);
  console.log(`  Parsed ${records.length} records`);
  if (records.length === 0) return { datasetId: 'national', success: true, recordsInserted: 0, recordsUpdated: 0, errors: 0 };

  await logger.start(records.length);
  const result = await importNationalRecords(supabase, records);
  await logger.complete({
    recordsProcessed: records.length,
    recordsSuccess: result.recordsInserted,
    recordsError: result.errors,
    errors: result.errors > 0 ? [`${result.errors} records failed`] : [],
  });
  return result;
}

async function importState(
  supabase: any,
  useHistory: boolean,
): Promise<ImportResult> {
  const config = REALTOR_DATASETS.find(d => d.id === 'realtor-state')!;
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_state',
    datasetId: 'realtor-state',
  });

  let csvContent: string;
  if (useHistory && config.historyFile) {
    const result = loadFromFile(config.historyFile);
    if (!result.success) {
      await logger.fail(`Failed to load file: ${result.error}`);
      return { datasetId: 'state', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
    }
    csvContent = result.csvContent!;
  } else {
    const result = await downloadDataset(config.downloadUrl);
    if (!result.success) {
      await logger.fail(`Failed to download: ${result.error}`);
      return { datasetId: 'state', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
    }
    csvContent = result.csvContent!;
  }

  const records = parseStateCSV(csvContent);
  console.log(`  Parsed ${records.length} records`);
  if (records.length === 0) return { datasetId: 'state', success: true, recordsInserted: 0, recordsUpdated: 0, errors: 0 };

  await logger.start(records.length);
  const result = await importStateRecords(supabase, records);
  await logger.complete({
    recordsProcessed: records.length,
    recordsSuccess: result.recordsInserted,
    recordsError: result.errors,
    errors: result.errors > 0 ? [`${result.errors} records failed`] : [],
  });
  return result;
}

async function importMetro(
  supabase: any,
): Promise<ImportResult> {
  const config = REALTOR_DATASETS.find(d => d.id === 'realtor-metro')!;
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_metro',
    datasetId: 'realtor-metro',
  });

  // Load core data
  console.log('  Loading core data...');
  const coreResult = loadFromFile(config.historyFile!);
  if (!coreResult.success) {
    await logger.fail(`Failed to load core file: ${coreResult.error}`);
    return { datasetId: 'metro', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
  }

  // Load hotness data
  console.log('  Loading hotness data...');
  const hotnessResult = loadFromFile(config.hotnessHistoryFile!);
  if (!hotnessResult.success) {
    await logger.fail(`Failed to load hotness file: ${hotnessResult.error}`);
    return { datasetId: 'metro', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
  }

  const coreRecords = parseMetroCoreCSV(coreResult.csvContent!);
  const hotnessMap = parseMetroHotnessCSV(hotnessResult.csvContent!);
  const mergedRecords = mergeMetroData(coreRecords, hotnessMap);
  console.log(`  Parsed ${coreRecords.length} core + ${hotnessMap.size} hotness => ${mergedRecords.length} merged`);
  if (mergedRecords.length === 0) return { datasetId: 'metro', success: true, recordsInserted: 0, recordsUpdated: 0, errors: 0 };

  await logger.start(mergedRecords.length);
  const result = await importMetroRecords(supabase, mergedRecords);
  await logger.complete({
    recordsProcessed: mergedRecords.length,
    recordsSuccess: result.recordsInserted,
    recordsError: result.errors,
    errors: result.errors > 0 ? [`${result.errors} records failed`] : [],
  });
  return result;
}

async function importCounty(
  supabase: any,
): Promise<ImportResult> {
  const config = REALTOR_DATASETS.find(d => d.id === 'realtor-county')!;
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_county',
    datasetId: 'realtor-county',
  });

  console.log('  Loading core data...');
  const coreResult = loadFromFile(config.historyFile!);
  if (!coreResult.success) {
    await logger.fail(`Failed to load core file: ${coreResult.error}`);
    return { datasetId: 'county', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
  }

  console.log('  Loading hotness data...');
  const hotnessResult = loadFromFile(config.hotnessHistoryFile!);
  if (!hotnessResult.success) {
    await logger.fail(`Failed to load hotness file: ${hotnessResult.error}`);
    return { datasetId: 'county', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
  }

  const coreRecords = parseCountyCoreCSV(coreResult.csvContent!);
  const hotnessMap = parseCountyHotnessCSV(hotnessResult.csvContent!);
  const mergedRecords = mergeCountyData(coreRecords, hotnessMap);
  console.log(`  Parsed ${coreRecords.length} core + ${hotnessMap.size} hotness => ${mergedRecords.length} merged`);
  if (mergedRecords.length === 0) return { datasetId: 'county', success: true, recordsInserted: 0, recordsUpdated: 0, errors: 0 };

  await logger.start(mergedRecords.length);
  const result = await importCountyRecords(supabase, mergedRecords);
  await logger.complete({
    recordsProcessed: mergedRecords.length,
    recordsSuccess: result.recordsInserted,
    recordsError: result.errors,
    errors: result.errors > 0 ? [`${result.errors} records failed`] : [],
  });
  return result;
}

async function importZip(
  supabase: any,
  useHistory: boolean,
  batchSize: number,
  limit: number | null,
  sinceDate: string | null,
): Promise<ImportResult> {
  const config = REALTOR_DATASETS.find(d => d.id === 'realtor-zip')!;
  const logger = createIngestionLogger(supabase, {
    source: 'realtor',
    tableName: 'realtor_zip',
    datasetId: 'realtor-zip',
  });

  // Load hotness data first (smaller file, fits in memory)
  console.log('  Loading hotness data...');
  let hotnessResult;
  if (useHistory) {
    hotnessResult = loadFromFile(config.hotnessHistoryFile!);
  } else {
    hotnessResult = await downloadDataset(config.hotnessUrl!);
  }
  if (!hotnessResult.success) {
    await logger.fail(`Failed to load hotness file: ${hotnessResult.error}`);
    return { datasetId: 'zip', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
  }

  const hotnessMap = parseZipHotnessCSV(hotnessResult.csvContent!);
  console.log(`  Parsed ${hotnessMap.size.toLocaleString()} hotness records`);

  await logger.start();

  if (!useHistory) {
    // Current month mode: download and import core data directly
    console.log('  Downloading current month core data...');
    const coreResult = await downloadDataset(config.downloadUrl);
    if (!coreResult.success) {
      await logger.fail(`Failed to download core data: ${coreResult.error}`);
      return { datasetId: 'zip', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
    }

    const { parse: parseCSV } = await import('csv-parse/sync');
    const rows = parseCSV(coreResult.csvContent!, { columns: true, skip_empty_lines: true, trim: true });
    console.log(`  Parsed ${rows.length.toLocaleString()} core records`);

    let recordsInserted = 0;
    let errors = 0;
    const records = rows.map((row: any) => parseZipRow(row, hotnessMap));

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchResult = await processZipBatch(supabase, batch);
      recordsInserted += batchResult.inserted;
      errors += batchResult.errors;
    }

    await logger.complete({
      recordsProcessed: records.length,
      recordsSuccess: recordsInserted,
      recordsError: errors,
      errors: errors > 0 ? [`${errors} records failed`] : [],
    });

    return { datasetId: 'zip', success: errors === 0, recordsInserted, recordsUpdated: 0, errors };
  }

  // History mode: stream from large file
  console.log('  Streaming core data from history file...');
  const coreFilePath = join(DATA_DIR, config.historyFile!);
  if (!existsSync(coreFilePath)) {
    await logger.fail(`Core history file not found: ${coreFilePath}`);
    return { datasetId: 'zip', success: false, recordsInserted: 0, recordsUpdated: 0, errors: 1 };
  }

  const result = await streamImportZipCore(supabase, coreFilePath, hotnessMap, batchSize, limit, sinceDate);

  await logger.complete({
    recordsProcessed: result.recordsInserted + result.errors,
    recordsSuccess: result.recordsInserted,
    recordsError: result.errors,
    errors: result.errors > 0 ? [`${result.errors} records failed`] : [],
  });

  return { datasetId: 'zip', success: result.errors === 0, recordsInserted: result.recordsInserted, recordsUpdated: 0, errors: result.errors };
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

const VALID_GEOS = ['national', 'state', 'metro', 'county', 'zip'];

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  // Parse arguments
  const geoFilters: string[] = [];
  let batchSize = 500;
  let limit: number | null = null;
  let sinceDate: string | null = null;
  const useHistory = args.includes('--history');
  const noRefresh = args.includes('--no-refresh');

  for (const arg of args) {
    if (arg.startsWith('--geo=')) {
      geoFilters.push(arg.split('=')[1].toLowerCase());
    }
    if (arg.startsWith('--batch=')) {
      const val = parseInt(arg.split('=')[1]);
      if (!isNaN(val) && val > 0) batchSize = val;
    }
    if (arg.startsWith('--limit=')) {
      const val = parseInt(arg.split('=')[1]);
      if (!isNaN(val) && val > 0) limit = val;
    }
    if (arg.startsWith('--since=')) {
      sinceDate = arg.split('=')[1];
    }
  }

  const geosToImport = geoFilters.length > 0 ? geoFilters : VALID_GEOS;

  // Validate geo filters
  for (const geo of geosToImport) {
    if (!VALID_GEOS.includes(geo)) {
      console.error(`Unknown geography: ${geo}`);
      console.error(`Valid options: ${VALID_GEOS.join(', ')}`);
      process.exit(1);
    }
  }

  console.log('Realtor.com Data Import');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${useHistory ? 'Historical files' : 'Current month download'}`);
  console.log(`Geographies: ${geosToImport.join(', ')}`);
  if (sinceDate) console.log(`Since filter: ${sinceDate}`);
  console.log('');

  const supabase = createRealtorImportClient();

  // Import each geography
  const results: ImportResult[] = [];

  for (const geo of geosToImport) {
    console.log(`\nImporting Realtor ${geo}...`);

    let result: ImportResult;
    try {
      switch (geo) {
        case 'national':
          result = await importNational(supabase, useHistory);
          break;
        case 'state':
          result = await importState(supabase, useHistory);
          break;
        case 'metro':
          result = await importMetro(supabase);
          break;
        case 'county':
          result = await importCounty(supabase);
          break;
        case 'zip':
          result = await importZip(supabase, useHistory, batchSize, limit, sinceDate);
          break;
        default:
          continue;
      }
      results.push(result);
    } catch (error: any) {
      console.error(`  Error importing ${geo}: ${error.message}`);
      results.push({
        datasetId: geo,
        success: false,
        recordsInserted: 0,
        recordsUpdated: 0,
        errors: 1,
        errorMessage: error.message,
      });
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalRecords = results.reduce((sum, r) => sum + r.recordsInserted, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.success ? 'OK' : 'ERRORS';
    console.log(`${result.datasetId}: ${result.recordsInserted.toLocaleString()} records [${status}]`);
  }

  console.log('-'.repeat(60));
  console.log(`Total records: ${totalRecords.toLocaleString()}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(60));

  if (totalErrors > 0) {
    console.log('\nImport completed with errors');
    process.exit(1);
  }

  // Refresh calculated metrics after successful import
  if (totalRecords > 0 && !noRefresh) {
    await refreshCalculatedMetrics(supabase);
  }

  console.log('\nImport completed successfully');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
