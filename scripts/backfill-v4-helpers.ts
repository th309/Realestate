/**
 * Backfill v4 Helpers
 *
 * Data fetching, scoring, and persistence functions for the v4 PropertyIQ
 * score backfill. Extracted from backfill-v4-scores.ts per 300-line limit.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { calculateV4Scores } from "../packages/backend/src/scoring/v4-scoring-engine";
import type { GeographyLevel } from "../packages/backend/src/scoring/formula-weights";
import type { LocationMetrics } from "../packages/backend/src/scoring/scoring.types";

const PAGE_SIZE = 1000;
const UPSERT_BATCH = 500;

// ---------------------------------------------------------------------------
// Redfin table/column helpers (mirrors scoring-data-helpers.ts)
// ---------------------------------------------------------------------------

function getRedfinTable(geo: GeographyLevel): string {
  return { metro: "redfin_metro", county: "redfin_county", zip: "redfin_zip" }[
    geo
  ];
}

function getRedfinIdCol(geo: GeographyLevel): string {
  return { metro: "cbsa_code", county: "fips_code", zip: "zip_code" }[geo];
}

function getRedfinNameCol(geo: GeographyLevel): string {
  return { metro: "region_name", county: "county_name", zip: "zip_code" }[geo];
}

export function toEndOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Generate monthly end-of-month dates (avoids expensive DISTINCT on large tables)
// ---------------------------------------------------------------------------

export function generateMonthlyDates(
  from: string,
  to: string | null,
): string[] {
  const dates: string[] = [];
  const [startY, startM] = from.split("-").map(Number);
  const endDate = to ? new Date(to) : new Date();

  let y = startY;
  let m = startM;

  while (true) {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    if (new Date(dateStr) > endDate) break;
    dates.push(dateStr);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return dates;
}

// ---------------------------------------------------------------------------
// Fetch v4 metrics for a single period
// ---------------------------------------------------------------------------

async function fetchV4MetricsForPeriod(
  supabase: SupabaseClient,
  geo: GeographyLevel,
  periodEnd: string,
): Promise<LocationMetrics[]> {
  const table = getRedfinTable(geo);
  const idCol = getRedfinIdCol(geo);
  const nameCol = getRedfinNameCol(geo);

  const selectCols = [
    idCol,
    nameCol,
    "sold_above_list",
    "median_dom",
    "months_of_supply",
    "median_sale_price",
  ].join(", ");

  const results: LocationMetrics[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq("property_type", "All Residential")
      .eq("period_end", periodEnd)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error)
      throw new Error(
        `Redfin fetch failed (${geo} ${periodEnd}): ${error.message}`,
      );
    if (!data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      if (!r[idCol]) continue; // skip rows with null location ID
      const loc: LocationMetrics & { months_of_supply?: number } = {
        location_id: r[idCol],
        location_name: r[nameCol] || r[idCol],
        median_price: r.median_sale_price ?? undefined,
        rf_sold_above_list: r.sold_above_list ?? undefined,
        rf_median_dom: r.median_dom ?? undefined,
      };
      if (r.months_of_supply != null) {
        (loc as Record<string, any>).months_of_supply = r.months_of_supply;
      }
      results.push(loc);
    }

    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Upsert score rows
// ---------------------------------------------------------------------------

async function upsertBatch(
  supabase: SupabaseClient,
  rows: Record<string, any>[],
): Promise<{ ok: number; err: number }> {
  let ok = 0;
  let err = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from("propertyiq_scores_v2")
      .upsert(batch, {
        onConflict: "geography,location_id,score_type,score_date",
      });

    if (error) {
      err += batch.length;
      if (err <= UPSERT_BATCH) {
        console.error(`  Upsert error: ${error.message}`);
      }
    } else {
      ok += batch.length;
    }
  }

  return { ok, err };
}

// ---------------------------------------------------------------------------
// Process one period for one geography
// ---------------------------------------------------------------------------

export async function processOnePeriod(
  supabase: SupabaseClient,
  geo: GeographyLevel,
  periodEnd: string,
  dryRun: boolean,
): Promise<{ scores: number; errors: number }> {
  const locations = await fetchV4MetricsForPeriod(supabase, geo, periodEnd);
  if (locations.length === 0) return { scores: 0, errors: 0 };

  const results = calculateV4Scores(locations, geo);
  if (results.length === 0) return { scores: 0, errors: 0 };

  if (dryRun) return { scores: results.length, errors: 0 };

  const createdAt = new Date().toISOString();
  const rows = results.map((r) => ({
    geography: geo,
    location_id: r.locationId,
    location_name: r.locationName,
    score_type: "propertyiq",
    score: r.score,
    grade: r.grade,
    confidence: r.confidence,
    confidence_level: r.confidenceLevel,
    median_price: r.medianPrice,
    score_date: periodEnd,
    created_at: createdAt,
    z_scores: JSON.stringify(r.inputMetrics),
  }));

  const { ok, err } = await upsertBatch(supabase, rows);
  return { scores: ok, errors: err };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

export function fmtNum(n: number): string {
  return n.toLocaleString();
}

export function fmtDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  if (mins < 60) return `${mins}m ${rem}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}
