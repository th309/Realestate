/**
 * Core+hotness merge import logic for Realtor metro, county, and zip geographies.
 *
 * Downloads core and hotness CSVs, maps core rows, merges hotness data,
 * applies date filtering and deduplication, then batch upserts.
 */

import { getSupabaseClient, batchUpsert } from "../../lib";
import { loadDataFileFiltered } from "../../lib/csv-stream-loader";
import type {
  ImportGeographyResult,
  BatchUpsertResult,
  ColumnMapFn,
} from "../../lib";
import { createIngestionLogger } from "../../utils/ingestion-logger";
import {
  buildHotnessMap,
  mergeCoreAndHotness,
  mapMetroCoreRow,
  mapCountyCoreRow,
  mapZipCoreRow,
  REALTOR_URLS,
  REALTOR_HISTORY_FILES,
  REALTOR_TABLES,
} from "./realtor-config";
import { monthCutoffFilter } from "./realtor-row-window";

export interface MergeGeographySpec {
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

export function buildMergeGeographies(
  useHistory: boolean,
): MergeGeographySpec[] {
  return [
    {
      id: "metro",
      ...REALTOR_TABLES.metro,
      coreUrl: REALTOR_URLS.metro.core,
      hotnessUrl: REALTOR_URLS.metro.hotness,
      coreLocalPath: useHistory ? REALTOR_HISTORY_FILES.metro.core : undefined,
      hotnessLocalPath: useHistory
        ? REALTOR_HISTORY_FILES.metro.hotness
        : undefined,
      coreColumnMap: mapMetroCoreRow,
      regionKeyField: "cbsa_code",
      hotnessIncludesExtras: false,
      datasetId: "realtor-metro",
    },
    {
      id: "county",
      ...REALTOR_TABLES.county,
      coreUrl: REALTOR_URLS.county.core,
      hotnessUrl: REALTOR_URLS.county.hotness,
      coreLocalPath: useHistory ? REALTOR_HISTORY_FILES.county.core : undefined,
      hotnessLocalPath: useHistory
        ? REALTOR_HISTORY_FILES.county.hotness
        : undefined,
      coreColumnMap: mapCountyCoreRow,
      regionKeyField: "county_fips",
      hotnessIncludesExtras: true,
      datasetId: "realtor-county",
    },
    {
      id: "zip",
      ...REALTOR_TABLES.zip,
      coreUrl: REALTOR_URLS.zip.core,
      hotnessUrl: REALTOR_URLS.zip.hotness,
      coreLocalPath: useHistory ? REALTOR_HISTORY_FILES.zip.core : undefined,
      hotnessLocalPath: useHistory
        ? REALTOR_HISTORY_FILES.zip.hotness
        : undefined,
      coreColumnMap: mapZipCoreRow,
      regionKeyField: "postal_code",
      hotnessIncludesExtras: true,
      datasetId: "realtor-zip",
    },
  ];
}

export async function importMergeGeography(
  spec: MergeGeographySpec,
  useHistory: boolean,
  dateCutoff?: string,
): Promise<ImportGeographyResult> {
  const importStartMs = Date.now();
  const supabase = getSupabaseClient();
  const logger = createIngestionLogger(supabase, {
    source: "realtor",
    tableName: spec.tableName,
    datasetId: spec.datasetId,
  });

  console.log(
    `\n--- Importing realtor / ${spec.id} -> ${spec.tableName} (core+hotness merge) ---`,
  );

  try {
    await logger.start(0);

    const coreData = await loadDataFileFiltered(
      {
        url: spec.coreUrl,
        localPath: useHistory ? spec.coreLocalPath : undefined,
        format: "csv",
      },
      monthCutoffFilter("month_date_yyyymm", dateCutoff),
    );
    const coreRows = coreData.rows; // already windowed during the stream
    console.log(
      `  Core rows: ${coreData.rowCount} seen -> ${coreRows.length} in window`,
    );

    const hotnessData = await loadDataFileFiltered(
      {
        url: spec.hotnessUrl,
        localPath: useHistory ? spec.hotnessLocalPath : undefined,
        format: "csv",
      },
      monthCutoffFilter("month_date_yyyymm", dateCutoff),
    );
    console.log(
      `  Hotness rows: ${hotnessData.rowCount} seen -> ${hotnessData.rows.length} in window`,
    );

    const coreRecords: Record<string, unknown>[] = [];
    let rowsSkippedByMapping = 0;
    for (const row of coreRows) {
      const mapped = spec.coreColumnMap(row);
      if (mapped !== null) {
        coreRecords.push(mapped);
      } else {
        rowsSkippedByMapping++;
      }
    }
    console.log(
      `  Core records mapped: ${coreRecords.length} (${rowsSkippedByMapping} skipped)`,
    );

    const hotnessMap = buildHotnessMap(
      hotnessData.rows,
      spec.regionKeyField,
      spec.hotnessIncludesExtras,
    );
    console.log(`  Hotness map entries: ${hotnessMap.size}`);

    const mergedRecords = mergeCoreAndHotness(
      coreRecords,
      hotnessMap,
      spec.regionKeyField,
    );
    const recordsWithHotness = mergedRecords.filter(
      (r) => r.hotness_score != null,
    ).length;
    const pct =
      mergedRecords.length > 0
        ? ((recordsWithHotness / mergedRecords.length) * 100).toFixed(1)
        : "0.0";
    console.log(
      `  Merged records: ${mergedRecords.length} (hotness matched: ${recordsWithHotness}/${mergedRecords.length} = ${pct}%)`,
    );

    if (mergedRecords.length === 0) {
      console.log("  No records to import, skipping.");
      return {
        geographyId: spec.id,
        tableName: spec.tableName,
        status: "skipped",
        recordsInserted: 0,
        recordsFailed: 0,
        totalRowsLoaded: coreData.rowCount,
        rowsSkippedByMapping,
        latestPeriodDate: null,
        errors: [],
        durationMs: Date.now() - importStartMs,
      };
    }

    const latestPeriodDate = mergedRecords.reduce<string | null>(
      (latest, record) => {
        const dateStr = record.period_date as string | undefined;
        if (!dateStr) return latest;
        return latest === null || dateStr > latest ? dateStr : latest;
      },
      null,
    );

    // Date windowing was applied during the streaming parse (monthCutoffFilter),
    // so mergedRecords is already the rolling window — no post-merge filter. (A
    // day-level `pd >= dateCutoff` here would wrongly drop the oldest month's
    // first-of-month rows that the month-level stream filter kept.)

    // Deduplicate by conflict keys
    const dedupKey = (r: Record<string, unknown>) =>
      spec.conflictKeys.map((k) => String(r[k] ?? "")).join("|");
    const dedupMap = new Map<string, Record<string, unknown>>();
    for (const record of mergedRecords) {
      dedupMap.set(dedupKey(record), record);
    }
    const dedupedRecords = Array.from(dedupMap.values());
    if (dedupedRecords.length < mergedRecords.length) {
      console.log(
        `  Deduplicated: ${mergedRecords.length} → ${dedupedRecords.length} records`,
      );
    }

    const batchSize = spec.id === "zip" ? 2000 : 5000;
    const upsertResult: BatchUpsertResult = await batchUpsert(
      supabase,
      dedupedRecords,
      {
        tableName: spec.tableName,
        conflictKeys: [...spec.conflictKeys],
        batchSize,
      },
    );

    await logger.complete({
      recordsProcessed: mergedRecords.length,
      recordsSuccess: upsertResult.inserted,
      recordsError: upsertResult.failed,
      errors: upsertResult.errors,
    });

    const status =
      upsertResult.failed === 0
        ? "success"
        : upsertResult.inserted === 0
          ? "failed"
          : "partial";
    return {
      geographyId: spec.id,
      tableName: spec.tableName,
      status,
      recordsInserted: upsertResult.inserted,
      recordsFailed: upsertResult.failed,
      totalRowsLoaded: coreData.rowCount,
      rowsSkippedByMapping,
      latestPeriodDate,
      errors: upsertResult.errors,
      durationMs: Date.now() - importStartMs,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  FATAL error importing ${spec.id}: ${message}`);
    await logger.fail(message);
    return {
      geographyId: spec.id,
      tableName: spec.tableName,
      status: "failed",
      recordsInserted: 0,
      recordsFailed: 0,
      totalRowsLoaded: 0,
      rowsSkippedByMapping: 0,
      latestPeriodDate: null,
      errors: [message],
      durationMs: Date.now() - importStartMs,
    };
  }
}
