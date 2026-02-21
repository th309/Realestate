/**
 * Redfin TSV streaming processor.
 *
 * Handles downloading gzipped TSV files from S3, decompressing them,
 * parsing the TSV content, and processing rows in chunks with geoid
 * resolution and batch upserting.
 *
 * This is separated from the entry point to keep file sizes under
 * the 300-line limit and to isolate the streaming I/O logic.
 */

import { promisify } from 'util';
import { gunzip } from 'zlib';
import { parse } from 'csv-parse';
import axios from 'axios';

import { getSupabaseClient, batchUpsert } from '../../lib';
import type { BatchUpsertResult, ImportGeographyResult } from '../../lib';
import { createIngestionLogger } from '../../utils/ingestion-logger';

import {
  REDFIN_S3_URLS,
  REDFIN_CONFLICT_KEYS,
  REDFIN_PROPERTY_TYPE_FILTER,
  getTableNameForYear,
  STREAMING_CHUNK_SIZE,
  UPSERT_BATCH_SIZE,
} from './redfin-config';
import {
  discoverMetricColumns,
  countBaseMetrics,
  mapTsvRowToRecord,
  type RedfinMetricColumn,
  type RedfinMappedRecord,
} from './redfin-column-maps';
import { resolveRedfinGeoid, getGeoidCacheSize } from './redfin-geoid-lookup';

const gunzipAsync = promisify(gunzip);

// ---------------------------------------------------------------------------
// Download and decompress
// ---------------------------------------------------------------------------

/**
 * Download a gzipped TSV file from S3 and return decompressed content as a string.
 */
export async function downloadAndDecompressTsv(url: string): Promise<string> {
  console.log(`  Downloading from: ${url.substring(0, 80)}...`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 300_000,
    maxContentLength: 500 * 1024 * 1024,
    headers: { 'User-Agent': 'PropertyIQ-DataPipeline/1.0' },
  });

  const buffer = Buffer.from(response.data);
  console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB (compressed)`);

  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
  if (isGzip) {
    const decompressed = await gunzipAsync(buffer);
    console.log(`  Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(2)} MB`);
    return decompressed.toString('utf-8');
  }

  return buffer.toString('utf-8');
}

// ---------------------------------------------------------------------------
// Group records by year-partitioned table and upsert
// ---------------------------------------------------------------------------

async function upsertRecordsByYear(
  records: Record<string, unknown>[],
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const supabase = getSupabaseClient();
  const recordsByTable = new Map<string, Record<string, unknown>[]>();

  for (const record of records) {
    const dateStr = record.metric_date as string;
    const year = new Date(dateStr).getFullYear();
    if (isNaN(year)) continue;

    const tableName = getTableNameForYear(year);
    if (!recordsByTable.has(tableName)) {
      recordsByTable.set(tableName, []);
    }
    recordsByTable.get(tableName)!.push(record);
  }

  let inserted = 0;
  let failed = 0;
  const allErrors: string[] = [];

  for (const [tableName, tableRecords] of recordsByTable) {
    const result: BatchUpsertResult = await batchUpsert(supabase, tableRecords, {
      tableName,
      conflictKeys: [...REDFIN_CONFLICT_KEYS],
      batchSize: UPSERT_BATCH_SIZE,
    });
    inserted += result.inserted;
    failed += result.failed;
    allErrors.push(...result.errors);
  }

  return { inserted, failed, errors: allErrors };
}

// ---------------------------------------------------------------------------
// Process a chunk: resolve geoids then upsert
// ---------------------------------------------------------------------------

async function processRowChunk(
  mappedRows: RedfinMappedRecord[],
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const supabase = getSupabaseClient();
  const records: Record<string, unknown>[] = [];

  for (const row of mappedRows) {
    const geoid = await resolveRedfinGeoid(
      supabase,
      row.metadata.regionType,
      row.metadata.regionName,
      row.metadata.stateCode,
    );
    records.push({ geoid, ...row.dbRecord });
  }

  return upsertRecordsByYear(records);
}

// ---------------------------------------------------------------------------
// Parse TSV content into row arrays
// ---------------------------------------------------------------------------

function parseTsvContent(tsvContent: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = [];
    const tsvParser = parse({
      delimiter: '\t',
      quote: '"',
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
      columns: false,
      skip_records_with_error: true,
      relax_column_count: true,
    });
    tsvParser.on('data', (record: string[]) => rows.push(record));
    tsvParser.on('error', reject);
    tsvParser.on('end', () => resolve(rows));
    tsvParser.write(tsvContent);
    tsvParser.end();
  });
}

// ---------------------------------------------------------------------------
// Import a single geography level (main processing loop)
// ---------------------------------------------------------------------------

/**
 * Download, parse, and import all Redfin data for a single geography level.
 */
export async function importRedfinGeography(
  geoLevel: string,
  rowLimit?: number,
): Promise<ImportGeographyResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  const result: ImportGeographyResult = {
    geographyId: geoLevel,
    tableName: `redfin_metrics (year-partitioned)`,
    status: 'failed',
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: 0,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  const logger = createIngestionLogger(supabase, {
    source: 'redfin',
    tableName: `redfin_metrics_${geoLevel}`,
    datasetId: `redfin-${geoLevel}`,
  });

  try {
    console.log(`\n--- Importing redfin / ${geoLevel} ---`);
    await logger.start(0);

    const downloadUrl = REDFIN_S3_URLS[geoLevel];
    if (!downloadUrl) throw new Error(`No S3 URL configured for: ${geoLevel}`);

    const tsvContent = await downloadAndDecompressTsv(downloadUrl);
    const allRows = await parseTsvContent(tsvContent);
    console.log(`  Parsed ${allRows.length} total rows from TSV`);

    if (allRows.length === 0) {
      result.status = 'skipped';
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // First row is the header
    const headers = allRows[0];
    const metricColumns = discoverMetricColumns(headers);
    console.log(`  Header: ${headers.length} columns, ${countBaseMetrics(metricColumns)} base metrics`);

    let currentChunk: RedfinMappedRecord[] = [];

    let propertyTypeSkipped = 0;

    for (let rowIndex = 1; rowIndex < allRows.length; rowIndex++) {
      if (rowLimit && rowIndex > rowLimit) break;

      const mapped = mapTsvRowToRecord(allRows[rowIndex], headers, metricColumns);
      if (mapped) {
        // Filter by property type: only import "All Residential" rows
        if (mapped.metadata.propertyType && mapped.metadata.propertyType !== REDFIN_PROPERTY_TYPE_FILTER) {
          propertyTypeSkipped++;
          result.rowsSkippedByMapping++;
          continue;
        }
        currentChunk.push(mapped);
        if (!result.latestPeriodDate || mapped.metadata.periodEnd > result.latestPeriodDate) {
          result.latestPeriodDate = mapped.metadata.periodEnd;
        }
      } else {
        result.rowsSkippedByMapping++;
      }

      if (currentChunk.length >= STREAMING_CHUNK_SIZE) {
        const chunkResult = await processRowChunk(currentChunk);
        result.recordsInserted += chunkResult.inserted;
        result.recordsFailed += chunkResult.failed;
        result.errors.push(...chunkResult.errors);
        currentChunk = [];
        await logger.updateProgress(result.recordsInserted, result.recordsFailed);

        if (rowIndex % 20_000 === 0) {
          console.log(`  Progress: ${rowIndex.toLocaleString()} rows, ${result.recordsInserted.toLocaleString()} inserted, cache: ${getGeoidCacheSize()} geoids`);
        }
      }
    }

    result.totalRowsLoaded = Math.min(allRows.length - 1, rowLimit ?? Infinity);
    if (propertyTypeSkipped > 0) {
      console.log(`  Filtered out ${propertyTypeSkipped.toLocaleString()} rows with non-"${REDFIN_PROPERTY_TYPE_FILTER}" property type`);
    }

    // Flush remaining chunk
    if (currentChunk.length > 0) {
      const chunkResult = await processRowChunk(currentChunk);
      result.recordsInserted += chunkResult.inserted;
      result.recordsFailed += chunkResult.failed;
      result.errors.push(...chunkResult.errors);
    }

    // Determine final status
    if (result.recordsFailed === 0 && result.recordsInserted > 0) {
      result.status = 'success';
    } else if (result.recordsInserted > 0 && result.recordsFailed > 0) {
      result.status = 'partial';
    } else if (result.recordsInserted === 0 && result.totalRowsLoaded > 0) {
      result.status = 'failed';
    } else {
      result.status = 'skipped';
    }

    await logger.complete({
      recordsProcessed: result.totalRowsLoaded - result.rowsSkippedByMapping,
      recordsSuccess: result.recordsInserted,
      recordsError: result.recordsFailed,
      errors: result.errors,
    });

    console.log(`  Done: ${result.recordsInserted.toLocaleString()} inserted, ${result.recordsFailed} failed, ${result.rowsSkippedByMapping} skipped`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    result.status = 'failed';
    console.error(`  FATAL error importing ${geoLevel}: ${message}`);
    await logger.fail(message);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
