/**
 * Redfin Migration metro-level importer.
 *
 * Downloads the Redfin migration TSV (origin_metro -> destination_metro pairs
 * + per-destination aggregates), parses it, splits aggregates from flow rows,
 * and upserts into:
 *   - redfin_migration_metro       (cbsa_code, period_date) aggregates
 *   - redfin_migration_flows_metro (origin_cbsa, destination_cbsa, period_date) pairs
 *
 * The TSV column names differ between Redfin's downloads; this parser uses
 * fallback lookups (e.g., `period_end || month`) so the same code handles
 * minor naming variations. Adjust `idx('...')` calls if Redfin renames columns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { REDFIN_MIGRATION_METRO_URL } from "./redfin-config";
import { downloadToMemory } from "./redfin-download";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedfinMigrationRow {
  period_date: string; // ISO YYYY-MM-01
  cbsa_code: string;
  region_name?: string;
  origin_cbsa?: string;
  destination_cbsa?: string;
  net_inflow?: number;
  inflow_share_pct?: number;
  outflow_share_pct?: number;
  total_users?: number;
  share_pct?: number;
  net_searches?: number;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Coerce a column value to number, returning undefined for empty/NaN. */
function toNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Coerce to integer; returns undefined for empty/NaN. */
function toInt(raw: string | undefined): number | undefined {
  const n = toNumber(raw);
  return n === undefined ? undefined : Math.trunc(n);
}

/** Normalise a period column value to ISO YYYY-MM-01. */
function normalisePeriodDate(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Accept YYYY-MM, YYYY-MM-DD, or M/D/YYYY-style values.
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Snap to month-start so the (cbsa_code, period_date) PK is stable.
    return `${trimmed.slice(0, 7)}-01`;
  }
  return trimmed;
}

/**
 * Parse a Redfin migration TSV (already decompressed) into typed rows.
 *
 * Header column names tried (first non-empty wins per field):
 *   period         : period_end | month
 *   destination    : destination_metro | region_id
 *   destination_nm : destination_metro_name | region_name
 *   origin         : origin_metro
 *   net_inflow     : net_inflow
 *   inflow_share   : inflow_share
 *   outflow_share  : outflow_share
 *   total_users    : total_users
 *   share          : share
 *   net_searches   : net_searches
 */
export function parseRedfinMigrationTsv(tsv: string): RedfinMigrationRow[] {
  const lines = tsv.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split("\t").map((h) => h.trim());
  const idx = (col: string) => header.indexOf(col);

  const periodIdxA = idx("period_end");
  const periodIdxB = idx("month");
  const destIdxA = idx("destination_metro");
  const destIdxB = idx("region_id");
  const destNameIdxA = idx("destination_metro_name");
  const destNameIdxB = idx("region_name");
  const originIdx = idx("origin_metro");
  const netInflowIdx = idx("net_inflow");
  const inflowShareIdx = idx("inflow_share");
  const outflowShareIdx = idx("outflow_share");
  const totalUsersIdx = idx("total_users");
  const shareIdx = idx("share");
  const netSearchesIdx = idx("net_searches");

  const get = (cols: string[], i: number): string | undefined =>
    i >= 0 ? cols[i] : undefined;

  const firstNonEmpty = (
    cols: string[],
    a: number,
    b: number,
  ): string | undefined => {
    const va = get(cols, a);
    if (va && va !== "") return va;
    return get(cols, b);
  };

  const rows: RedfinMigrationRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split("\t");

    const periodRaw = firstNonEmpty(cols, periodIdxA, periodIdxB);
    const destinationCbsa = firstNonEmpty(cols, destIdxA, destIdxB);
    if (!periodRaw || !destinationCbsa) continue;

    const originCbsa = get(cols, originIdx);
    const regionName = firstNonEmpty(cols, destNameIdxA, destNameIdxB);

    rows.push({
      period_date: normalisePeriodDate(periodRaw),
      cbsa_code: destinationCbsa.trim(),
      region_name: regionName?.trim() || undefined,
      origin_cbsa: originCbsa?.trim() || undefined,
      destination_cbsa: destinationCbsa.trim(),
      net_inflow: toInt(get(cols, netInflowIdx)),
      inflow_share_pct: toNumber(get(cols, inflowShareIdx)),
      outflow_share_pct: toNumber(get(cols, outflowShareIdx)),
      total_users: toInt(get(cols, totalUsersIdx)),
      share_pct: toNumber(get(cols, shareIdx)),
      net_searches: toInt(get(cols, netSearchesIdx)),
    });
  }
  return rows;
}

/**
 * Split parsed rows into per-metro aggregates and origin↔destination pairs.
 *
 * Aggregate row = origin_cbsa missing OR origin_cbsa === destination_cbsa.
 * Flow row     = origin_cbsa present AND distinct from destination_cbsa.
 */
export function splitMetroAndFlowRows(rows: RedfinMigrationRow[]) {
  const metroRows = rows.filter(
    (r) => !r.origin_cbsa || r.origin_cbsa === r.destination_cbsa,
  );
  const flowRows = rows.filter(
    (r) => r.origin_cbsa && r.origin_cbsa !== r.destination_cbsa,
  );
  return { metroRows, flowRows };
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

const UPSERT_BATCH = 500;

async function upsertBatched<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const slice = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from(table).upsert(slice, { onConflict });
    if (error) {
      throw new Error(
        `[redfin-migration] upsert ${table} batch ${i}-${i + slice.length} failed: ${error.message}`,
      );
    }
  }
}

/**
 * Download, parse, and upsert the Redfin migration metro dataset.
 *
 * Idempotent: every row has a deterministic primary key derived from
 * (cbsa_code, period_date) for aggregates and
 * (origin_cbsa, destination_cbsa, period_date) for flows, so re-runs upsert
 * in place rather than duplicating rows.
 */
export async function importRedfinMigration(supabase: SupabaseClient): Promise<{
  metro: number;
  flows: number;
}> {
  console.log(`[redfin-migration] downloading ${REDFIN_MIGRATION_METRO_URL}`);
  const tsv = await downloadToMemory(REDFIN_MIGRATION_METRO_URL);
  const rows = parseRedfinMigrationTsv(tsv);
  const { metroRows, flowRows } = splitMetroAndFlowRows(rows);
  console.log(
    `[redfin-migration] parsed ${rows.length} rows -> ${metroRows.length} aggregate, ${flowRows.length} flow`,
  );

  const metroPayload = metroRows.map((r) => ({
    cbsa_code: r.cbsa_code,
    region_name: r.region_name ?? null,
    period_date: r.period_date,
    net_inflow: r.net_inflow ?? null,
    inflow_share_pct: r.inflow_share_pct ?? null,
    outflow_share_pct: r.outflow_share_pct ?? null,
    total_users: r.total_users ?? null,
  }));

  const flowPayload = flowRows
    .filter((r) => r.origin_cbsa && r.destination_cbsa)
    .map((r) => ({
      origin_cbsa: r.origin_cbsa as string,
      destination_cbsa: r.destination_cbsa as string,
      period_date: r.period_date,
      share_pct: r.share_pct ?? null,
      net_searches: r.net_searches ?? null,
    }));

  await upsertBatched(
    supabase,
    "redfin_migration_metro",
    metroPayload,
    "cbsa_code,period_date",
  );
  await upsertBatched(
    supabase,
    "redfin_migration_flows_metro",
    flowPayload,
    "origin_cbsa,destination_cbsa,period_date",
  );

  console.log(
    `[redfin-migration] upserted metro=${metroPayload.length} flows=${flowPayload.length}`,
  );
  return { metro: metroPayload.length, flows: flowPayload.length };
}
