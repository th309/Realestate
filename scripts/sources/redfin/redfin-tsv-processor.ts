/**
 * Redfin TSV processor for the shared import framework.
 *
 * Handles parsing TSV content (in-memory or streamed from disk) and
 * upserting into per-geography tables (redfin_state, redfin_metro, etc.).
 *
 * Download logic is in redfin-download.ts. Column mapping is in
 * redfin-column-maps.ts. This file orchestrates the import flow.
 */

import { createReadStream } from "fs";
import { unlink } from "fs/promises";
import { parse } from "csv-parse";

import { getSupabaseClient, batchUpsert } from "../../lib";
import type { ImportGeographyResult } from "../../lib";
import { createIngestionLogger } from "../../utils/ingestion-logger";

import {
  REDFIN_S3_URLS,
  REDFIN_TABLE_NAMES,
  REDFIN_CONFLICT_KEYS,
  UPSERT_BATCH_SIZE,
} from "./redfin-config";
import { mapTsvRowToRecord } from "./redfin-column-maps";
import { downloadToMemory, downloadToDisk } from "./redfin-download";

/** Geo levels small enough to load into memory as a string. */
const IN_MEMORY_GEOS = new Set(["national", "state"]);

// ---------------------------------------------------------------------------
// County FIPS lookup
// ---------------------------------------------------------------------------

let countyFipsMap: Map<string, string> | null = null;

async function initCountyFipsLookup(): Promise<void> {
  if (countyFipsMap) return;
  const supabase = getSupabaseClient();
  countyFipsMap = new Map();

  const { data, error } = await supabase
    .from("geography_crosswalk")
    .select("county_name, state_code, county_fips")
    .not("county_fips", "is", null);

  if (error || !data) {
    console.warn(
      "  Warning: Could not load county FIPS lookup:",
      error?.message,
    );
    return;
  }

  for (const row of data) {
    if (row.county_name && row.state_code && row.county_fips) {
      const key = `${row.county_name.toLowerCase()}|${row.state_code.toUpperCase()}`;
      countyFipsMap.set(key, row.county_fips);
    }
  }
  console.log(`  County FIPS lookup loaded: ${countyFipsMap.size} entries`);
}

function lookupCountyFips(
  county: string | null,
  state: string | null,
): string | null {
  if (!county || !state || !countyFipsMap) return null;
  return (
    countyFipsMap.get(`${county.toLowerCase()}|${state.toUpperCase()}`) || null
  );
}

// ---------------------------------------------------------------------------
// In-memory import (small files: national, state)
// ---------------------------------------------------------------------------

async function importSmallFile(
  geoLevel: string,
  tsvContent: string,
  tableName: string,
  dateCutoff?: string | null,
): Promise<{ inserted: number; failed: number; latestDate: string | null }> {
  const supabase = getSupabaseClient();
  const conflictKeys = REDFIN_CONFLICT_KEYS[tableName].split(",");

  return new Promise((resolve, reject) => {
    const records: Record<string, unknown>[] = [];
    let latestDate: string | null = null;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: "\t",
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    parser.on("data", (row: Record<string, string>) => {
      const mapped = mapTsvRowToRecord(
        row,
        geoLevel,
        lookupCountyFips,
        dateCutoff,
      );
      if (mapped) {
        records.push(mapped.dbRecord);
        if (!latestDate || mapped.periodEnd > latestDate)
          latestDate = mapped.periodEnd;
      }
    });

    parser.on("error", reject);
    parser.on("end", async () => {
      console.log(`  Parsed ${records.length} records (after filtering)`);
      const result = await batchUpsert(supabase, records, {
        tableName,
        conflictKeys,
        batchSize: UPSERT_BATCH_SIZE,
      });
      resolve({ inserted: result.inserted, failed: result.failed, latestDate });
    });

    parser.write(tsvContent);
    parser.end();
  });
}

// ---------------------------------------------------------------------------
// Streaming import (large files: metro, county, city, zip, neighborhood)
// ---------------------------------------------------------------------------

async function importLargeFile(
  geoLevel: string,
  tsvPath: string,
  tableName: string,
  dateCutoff?: string | null,
): Promise<{ inserted: number; failed: number; latestDate: string | null }> {
  const supabase = getSupabaseClient();
  const conflictKeys = REDFIN_CONFLICT_KEYS[tableName].split(",");

  let inserted = 0;
  let failed = 0;
  let latestDate: string | null = null;
  let batch: Record<string, unknown>[] = [];
  let rawCount = 0;

  const readStream = createReadStream(tsvPath, { encoding: "utf-8" });
  const parser = readStream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      delimiter: "\t",
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }),
  );

  for await (const row of parser) {
    rawCount++;
    const mapped = mapTsvRowToRecord(
      row as Record<string, string>,
      geoLevel,
      lookupCountyFips,
      dateCutoff,
    );
    if (!mapped) continue;

    batch.push(mapped.dbRecord);
    if (!latestDate || mapped.periodEnd > latestDate)
      latestDate = mapped.periodEnd;

    if (batch.length >= UPSERT_BATCH_SIZE) {
      const result = await batchUpsert(supabase, batch, {
        tableName,
        conflictKeys,
        batchSize: UPSERT_BATCH_SIZE,
      });
      inserted += result.inserted;
      failed += result.failed;
      batch = [];
    }

    if (rawCount % 500_000 === 0) {
      console.log(
        `  Progress: ${rawCount.toLocaleString()} raw rows, ${inserted.toLocaleString()} inserted`,
      );
    }
  }

  if (batch.length > 0) {
    const result = await batchUpsert(supabase, batch, {
      tableName,
      conflictKeys,
      batchSize: UPSERT_BATCH_SIZE,
    });
    inserted += result.inserted;
    failed += result.failed;
  }

  await unlink(tsvPath).catch(() => {});
  console.log(
    `  Complete: ${rawCount.toLocaleString()} rows parsed, ${inserted.toLocaleString()} inserted`,
  );
  return { inserted, failed, latestDate };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Download, parse, and import all Redfin data for a single geography level. */
export async function importRedfinGeography(
  geoLevel: string,
  _rowLimit?: number,
  recentMonths?: number,
): Promise<ImportGeographyResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  const tableName = REDFIN_TABLE_NAMES[geoLevel];
  if (!tableName)
    throw new Error(`No table configured for geography: ${geoLevel}`);

  const result: ImportGeographyResult = {
    geographyId: geoLevel,
    tableName,
    status: "failed",
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: 0,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  const logger = createIngestionLogger(supabase, {
    source: "redfin",
    tableName,
    datasetId: `redfin-${geoLevel}`,
  });

  try {
    console.log(`\n--- Importing redfin / ${geoLevel} ---`);
    await logger.start(0);

    const downloadUrl = REDFIN_S3_URLS[geoLevel];
    if (!downloadUrl) throw new Error(`No S3 URL configured for: ${geoLevel}`);

    if (geoLevel === "county") await initCountyFipsLookup();

    // Compute date cutoff for --recent flag
    let dateCutoff: string | null = null;
    if (recentMonths) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - recentMonths);
      dateCutoff = cutoff.toISOString().slice(0, 10);
      console.log(
        `  Date cutoff: ${dateCutoff} (recent ${recentMonths} months)`,
      );
    }

    let importResult: {
      inserted: number;
      failed: number;
      latestDate: string | null;
    };

    if (IN_MEMORY_GEOS.has(geoLevel)) {
      const tsvContent = await downloadToMemory(downloadUrl);
      importResult = await importSmallFile(
        geoLevel,
        tsvContent,
        tableName,
        dateCutoff,
      );
    } else {
      const tsvPath = await downloadToDisk(downloadUrl);
      importResult = await importLargeFile(
        geoLevel,
        tsvPath,
        tableName,
        dateCutoff,
      );
    }

    result.recordsInserted = importResult.inserted;
    result.recordsFailed = importResult.failed;
    result.latestPeriodDate = importResult.latestDate;

    if (importResult.failed === 0 && importResult.inserted > 0)
      result.status = "success";
    else if (importResult.inserted > 0) result.status = "partial";

    await logger.complete({
      recordsProcessed: importResult.inserted + importResult.failed,
      recordsSuccess: importResult.inserted,
      recordsError: importResult.failed,
      errors: result.errors,
    });
    console.log(
      `  Done: ${importResult.inserted.toLocaleString()} inserted, ${importResult.failed} failed`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    result.status = "failed";
    console.error(`  FATAL error importing ${geoLevel}: ${message}`);
    await logger.fail(message);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
