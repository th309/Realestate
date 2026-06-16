/**
 * Core+hotness merge import logic for Realtor metro, county, and zip geographies.
 *
 * Downloads core and hotness CSVs, maps core rows, merges hotness data,
 * applies date filtering and deduplication, then batch upserts.
 */

import { getSupabaseClient, loadDataFile, batchUpsert } from "../../lib";
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

/**
 * Keep only rows within the last `months` months of the most recent month in
 * the data. The Realtor hotness files are full HISTORY (millions of rows), but
 * the core files are current-month, so we only need a recent hotness window to
 * merge. Filtering BEFORE building the in-memory map keeps memory bounded as the
 * history grows — this is what the import is meant to do ("only the last N
 * months"), and it prevents the JS-heap OOM (exit 134) the full-history load hit.
 * `monthField` values are YYYYMM strings, which sort lexically.
 */
function filterToRecentMonths(
  rows: Record<string, string>[],
  monthField: string,
  months: number,
): Record<string, string>[] {
  let maxYm = "";
  for (const r of rows) {
    const ym = r[monthField];
    if (ym && ym > maxYm) maxYm = ym;
  }
  if (maxYm.length !== 6) return rows; // unknown format — don't risk dropping data
  const year = Number(maxYm.slice(0, 4));
  const mon = Number(maxYm.slice(4, 6));
  const d = new Date(Date.UTC(year, mon - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  const cutoff = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return rows.filter((r) => {
    const ym = r[monthField];
    return !ym || ym >= cutoff;
  });
}

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

    const coreData = await loadDataFile({
      url: spec.coreUrl,
      localPath: useHistory ? spec.coreLocalPath : undefined,
      format: "csv",
    });
    console.log(`  Core rows loaded: ${coreData.rowCount}`);

    const hotnessData = await loadDataFile({
      url: spec.hotnessUrl,
      localPath: useHistory ? spec.hotnessLocalPath : undefined,
      format: "csv",
    });
    console.log(`  Hotness rows loaded: ${hotnessData.rowCount}`);

    const coreRecords: Record<string, unknown>[] = [];
    let rowsSkippedByMapping = 0;
    for (const row of coreData.rows) {
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
      filterToRecentMonths(hotnessData.rows, "month_date_yyyymm", 12),
      spec.regionKeyField,
      spec.hotnessIncludesExtras,
    );
    console.log(
      `  Hotness map entries: ${hotnessMap.size} (windowed to last 12 mo from ${hotnessData.rowCount} rows)`,
    );

    let mergedRecords = mergeCoreAndHotness(
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

    // Filter by date cutoff (--recent flag)
    if (dateCutoff) {
      const beforeDate = mergedRecords.length;
      mergedRecords = mergedRecords.filter((r) => {
        const pd = r.period_date as string | undefined;
        return !pd || pd >= dateCutoff;
      });
      if (mergedRecords.length < beforeDate) {
        console.log(
          `  Date filter (>= ${dateCutoff}): ${beforeDate} → ${mergedRecords.length} records`,
        );
      }
    }

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
