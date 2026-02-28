/**
 * Dataset import strategies for the Redfin sales pipeline.
 *
 * Provides two modes:
 *   - In-memory: for small files (national, state, metro)
 *   - Streaming: for large files (county, city, zip, neighborhood)
 *
 * The unified `importDataset` function picks the right mode automatically.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  downloadAndDecompress,
  downloadToDiskThenStream,
  needsStreaming,
} from "./download";
import { parseTsv, parseTsvStream } from "./parser";
import { upsertBatch, BATCH_SIZE } from "./db-client";
import type { RedfinS3Dataset, RedfinGeoLevel, ImportResult } from "./types";

const MAX_AUTO_BATCH_SIZE = 5000;
const GEO_BATCH_SIZES: Record<RedfinGeoLevel, number> = {
  national: 5000,
  state: 5000,
  metro: 3000,
  county: 2000,
  city: 2000,
  zip: 1000,
  neighborhood: 1000,
};

function getAutoBatchSize(geoLevel: RedfinGeoLevel): number {
  const preferred = GEO_BATCH_SIZES[geoLevel] ?? BATCH_SIZE;
  return Math.max(1, Math.min(preferred, MAX_AUTO_BATCH_SIZE));
}

function makeEmptyResult(dataset: RedfinS3Dataset): ImportResult {
  return {
    geoLevel: dataset.geoLevel,
    tableName: dataset.tableName,
    totalRows: 0,
    inserted: 0,
    errors: 0,
    durationMs: 0,
  };
}

/** Import a small dataset entirely in memory */
async function importDatasetInMemory(
  supabase: SupabaseClient,
  dataset: RedfinS3Dataset,
  rowLimit?: number,
  batchSize: number = BATCH_SIZE,
): Promise<ImportResult> {
  const startTime = Date.now();
  const result = makeEmptyResult(dataset);

  try {
    let tsv = await downloadAndDecompress(dataset);
    let records = parseTsv(tsv, dataset.geoLevel);
    tsv = "";
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

    const totalBatches = Math.ceil(records.length / batchSize);
    console.log(
      `    Upserting ${records.length} records in ${totalBatches} batches into ${dataset.tableName}...`,
    );

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const batchResult = await upsertBatch(
        supabase,
        dataset.tableName,
        batch,
        batchNum,
        totalBatches,
      );
      result.inserted += batchResult.inserted;
      result.errors += batchResult.errors;
    }
  } catch (error: any) {
    console.error(
      `    Fatal error importing ${dataset.geoLevel}: ${error.message}`,
    );
    result.errors++;
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/** Import a large dataset via streaming (never holds full file in memory) */
async function importDatasetStreaming(
  supabase: SupabaseClient,
  dataset: RedfinS3Dataset,
  rowLimit?: number,
  batchSize: number = BATCH_SIZE,
): Promise<ImportResult> {
  const startTime = Date.now();
  const result = makeEmptyResult(dataset);

  let cleanup = () => {};
  try {
    const downloaded = await downloadToDiskThenStream(dataset);
    cleanup = downloaded.cleanup;
    const stream = downloaded.stream;

    console.log(
      `    Stream-parsing from disk + upserting (batch size: ${batchSize})...`,
    );

    let batchNum = 0;
    let limitReached = false;

    for await (const { batch, rawCount, filteredCount } of parseTsvStream(
      stream,
      dataset.geoLevel,
      batchSize,
    )) {
      batchNum++;
      result.totalRows = filteredCount;

      let recordsToInsert = batch;
      if (rowLimit && result.inserted + batch.length > rowLimit) {
        const remaining = rowLimit - result.inserted;
        if (remaining <= 0) break;
        recordsToInsert = batch.slice(0, remaining);
        limitReached = true;
      }

      const batchResult = await upsertBatch(
        supabase,
        dataset.tableName,
        recordsToInsert,
        batchNum,
        -1,
      );
      result.inserted += batchResult.inserted;
      result.errors += batchResult.errors;

      if (limitReached) {
        console.log(
          `    Row limit ${rowLimit} reached after ${batchNum} batches`,
        );
        break;
      }
    }

    console.log(
      `    Complete: ${result.totalRows.toLocaleString()} rows parsed, ${result.inserted.toLocaleString()} inserted, ${batchNum} batches`,
    );
  } catch (error: any) {
    console.error(
      `    Fatal error importing ${dataset.geoLevel}: ${error.message}`,
    );
    result.errors++;
  } finally {
    cleanup();
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/** Import a dataset, automatically choosing in-memory or streaming mode */
export async function importDataset(
  supabase: SupabaseClient,
  dataset: RedfinS3Dataset,
  rowLimit?: number,
): Promise<ImportResult> {
  const batchSize = getAutoBatchSize(dataset.geoLevel);
  console.log(
    `    Auto batch size selected: ${batchSize} (cap: ${MAX_AUTO_BATCH_SIZE})`,
  );

  if (needsStreaming(dataset.geoLevel)) {
    return importDatasetStreaming(supabase, dataset, rowLimit, batchSize);
  }
  return importDatasetInMemory(supabase, dataset, rowLimit, batchSize);
}
