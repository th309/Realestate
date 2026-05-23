/**
 * Generic processor for Redfin Data Center CSVs.
 *
 * Because every dashboard CSV shares the same shape (6 metadata columns + N
 * metric columns), one mapper handles all of them: normalize each header,
 * keep only columns that exist in the target table, convert NA→null, resolve
 * the region, and emit a DB record.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeColumnName,
  normalizeRegionTypeToGeoLevel,
} from "./redfin-dc-column-normalizer";
import type { GeoTarget } from "./redfin-dc-config";
import { resolveDcGeo, type ResolvedGeo } from "./redfin-dc-geo-resolver";

const META_TO_COLUMN: Record<string, string> = {
  "period begin": "period_begin",
  "period end": "period_end",
  frequency: "frequency",
  "last updated": "last_updated",
};

type ResolveFn = (
  supabase: SupabaseClient,
  geoLevel: string,
  regionName: string,
) => Promise<ResolvedGeo>;

function parseValue(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === "" || t.toUpperCase() === "NA") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/**
 * Map one raw CSV row to a DB record. Returns null only on a missing period_end
 * (structurally invalid row). Unresolved geos still produce a record (with the
 * fallback id) but are counted by the caller via the returned `resolved` flag.
 */
export async function mapRowToRecord(
  supabase: SupabaseClient,
  row: Record<string, string>,
  geoLevel: string,
  target: GeoTarget,
  knownColumns: ReadonlySet<string>,
  resolve: ResolveFn = resolveDcGeo,
): Promise<(Record<string, unknown> & { __resolved: boolean }) | null> {
  const rec: Record<string, unknown> = {};

  for (const [rawHeader, rawValue] of Object.entries(row)) {
    const header = rawHeader.trim();
    const lower = header.toLowerCase();
    if (lower === "region type") continue;
    if (lower === "region name") {
      rec.region_name = (rawValue ?? "").trim();
      continue;
    }
    if (META_TO_COLUMN[lower]) {
      const col = META_TO_COLUMN[lower];
      const v = (rawValue ?? "").trim();
      rec[col] = v === "" || v.toUpperCase() === "NA" ? null : v;
      continue;
    }
    const col = normalizeColumnName(header);
    if (!knownColumns.has(col)) continue;
    if (target.textDims?.includes(col)) {
      const v = (rawValue ?? "").trim();
      rec[col] = v === "" || v.toUpperCase() === "NA" ? null : v;
    } else {
      rec[col] = parseValue(rawValue);
    }
  }

  if (!rec.period_end) return null;

  let resolved = true;
  if (target.noGeo) {
    rec.region_id = "US";
  } else {
    const regionName = String(rec.region_name ?? "");
    const r = await resolve(supabase, geoLevel, regionName);
    rec.region_id = r.regionId;
    resolved = r.resolved;
  }

  return Object.assign(rec, { __resolved: resolved });
}

export interface ProcessResult {
  records: Record<string, unknown>[];
  skipped: number;
  unresolved: number;
  latestPeriodEnd: string | null;
}

const UNRESOLVED_HARD_FAIL_RATIO = 0.1;

/** Map an array of rows; enforce the >10% unresolved hard-fail. */
export async function processRows(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  geoLevel: string,
  target: GeoTarget,
  knownColumns: string[],
  resolve: ResolveFn = resolveDcGeo,
): Promise<ProcessResult> {
  const records: Record<string, unknown>[] = [];
  let skipped = 0;
  let unresolved = 0;
  let latestPeriodEnd: string | null = null;
  // Build the lookup set once per file, not once per row (files reach ~20k rows).
  const known = new Set(knownColumns);

  for (const row of rows) {
    const mapped = await mapRowToRecord(
      supabase,
      row,
      geoLevel,
      target,
      known,
      resolve,
    );
    if (!mapped) {
      skipped += 1;
      continue;
    }
    const { __resolved, ...rec } = mapped;
    if (!__resolved) unresolved += 1;
    const pe = String(rec.period_end);
    if (!latestPeriodEnd || pe > latestPeriodEnd) latestPeriodEnd = pe;
    records.push(rec);
  }

  const total = records.length + skipped;
  if (total > 0 && unresolved / total > UNRESOLVED_HARD_FAIL_RATIO) {
    throw new Error(
      `[redfin-dc] ${target.table}: ${unresolved}/${total} rows unresolved ` +
        `(>${UNRESOLVED_HARD_FAIL_RATIO * 100}%). Aborting — likely schema/source drift.`,
    );
  }

  return { records, skipped, unresolved, latestPeriodEnd };
}

export { normalizeRegionTypeToGeoLevel };
