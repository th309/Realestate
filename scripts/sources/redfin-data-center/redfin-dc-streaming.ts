/**
 * Streaming CSV pipeline for the Redfin Data Center importer.
 *
 * Replaces the full-buffer approach (downloadFromUrl → csvParse/sync → processRows)
 * with a constant-memory pipeline:
 *   axios stream → csv-parse Transform → Writable batch buffer → batchUpsert
 *
 * Peak memory is proportional to PIPELINE_BATCH_SIZE rows, not total file size.
 * The 425MB housing_market/zip CSV (2.4M rows, ~6.5GB parsed) previously OOM'd;
 * this pipeline runs comfortably at <512MB.
 */

import { Writable } from "stream";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import { parse as csvParseStream } from "csv-parse";
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "../../lib/batch-upsert";
import { mapRowToRecord } from "./redfin-dc-csv-processor";
import type { GeoTarget } from "./redfin-dc-config";

/** Number of mapped records to accumulate before each upsert flush. */
export const PIPELINE_BATCH_SIZE = 2500;

const UNRESOLVED_HARD_FAIL_RATIO = 0.1;

export interface StreamingPipelineOptions {
  supabase: SupabaseClient;
  stream: Readable;
  target: GeoTarget;
  geoLevel: string;
  knownColumns: ReadonlySet<string>;
  dateCutoff: string | null;
  rowLimit: number | undefined;
  upsertBatchSize: number;
}

export interface StreamingPipelineResult {
  totalRowsLoaded: number;
  rowsSkippedByMapping: number;
  unresolved: number;
  latestPeriodDate: string | null;
  recordsInserted: number;
  recordsFailed: number;
  errors: string[];
}

/**
 * Run the streaming CSV pipeline end-to-end.
 *
 * Reads from `options.stream`, parses with csv-parse, maps each row via
 * mapRowToRecord, accumulates into PIPELINE_BATCH_SIZE-sized buffers, and
 * flushes each buffer to Supabase via batchUpsert. Returns aggregate counts.
 *
 * Throws if >10% of rows are geo-unresolvable (same contract as processRows).
 */
export async function runStreamingPipeline(
  options: StreamingPipelineOptions,
): Promise<StreamingPipelineResult> {
  const {
    supabase,
    stream,
    target,
    geoLevel,
    knownColumns,
    dateCutoff,
    rowLimit,
    upsertBatchSize,
  } = options;

  let totalRowsLoaded = 0;
  let rowsSkippedByMapping = 0;
  let unresolved = 0;
  let latestPeriodDate: string | null = null;
  let recordsInserted = 0;
  let recordsFailed = 0;
  const errors: string[] = [];
  let batch: Record<string, unknown>[] = [];
  let batchNumber = 0;

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) return;
    batchNumber += 1;
    const up = await batchUpsert(supabase, batch, {
      tableName: target.table,
      conflictKeys: target.conflictKeys,
      batchSize: upsertBatchSize,
    });
    console.log(
      `  Pipeline batch ${batchNumber}: ${up.inserted} inserted, ${up.failed} failed (running total: ${recordsInserted + up.inserted} inserted)`,
    );
    recordsInserted += up.inserted;
    recordsFailed += up.failed;
    errors.push(...up.errors);
    batch = [];
  }

  const parser = csvParseStream({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  // Writable in object mode — receives one parsed row at a time from csv-parse.
  // highWaterMark=16 keeps the backpressure window small so csv-parse doesn't
  // buffer thousands of rows before the Writable drains them.
  const consumer = new Writable({
    objectMode: true,
    highWaterMark: 16,
    write(row: Record<string, string>, _enc, cb) {
      // Async write handler — we must call cb() exactly once, even on error.
      (async () => {
        try {
          totalRowsLoaded += 1;

          // rowLimit: count raw rows loaded (pre-filter), stop accepting new
          // ones once exceeded. Date filter is also applied pre-mapping.
          if (rowLimit !== undefined && totalRowsLoaded > rowLimit) {
            return cb();
          }

          if (dateCutoff) {
            const pe = (row["PERIOD END"] ?? row["period end"] ?? "").trim();
            // Rows with no period_end are structurally invalid — mapRowToRecord
            // will skip them too, but skip early here to save a resolve call.
            if (pe && pe < dateCutoff) return cb();
          }

          const mapped = await mapRowToRecord(
            supabase,
            row,
            geoLevel,
            target,
            knownColumns,
          );

          if (!mapped) {
            rowsSkippedByMapping += 1;
            return cb();
          }

          const { __resolved, ...rec } = mapped;
          if (!__resolved) unresolved += 1;

          const pe = String(rec.period_end);
          if (!latestPeriodDate || pe > latestPeriodDate) {
            latestPeriodDate = pe;
          }

          batch.push(rec);

          if (batch.length >= upsertBatchSize) {
            await flushBatch();
          }

          cb();
        } catch (err) {
          cb(err instanceof Error ? err : new Error(String(err)));
        }
      })();
    },
  });

  // pipeline() propagates errors from any stage and destroys the remaining
  // streams automatically — no manual cleanup needed.
  await pipeline(stream, parser, consumer);

  // Flush any partial batch remaining after the stream ends.
  await flushBatch();

  // Enforce the >10% unresolved hard-fail (same contract as processRows).
  const total = recordsInserted + rowsSkippedByMapping + unresolved;
  if (total > 0 && unresolved / total > UNRESOLVED_HARD_FAIL_RATIO) {
    throw new Error(
      `[redfin-dc] ${target.table}: ${unresolved}/${total} rows unresolved ` +
        `(>${UNRESOLVED_HARD_FAIL_RATIO * 100}%). Aborting — likely schema/source drift.`,
    );
  }

  return {
    totalRowsLoaded,
    rowsSkippedByMapping,
    unresolved,
    latestPeriodDate,
    recordsInserted,
    recordsFailed,
    errors,
  };
}
