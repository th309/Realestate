#!/usr/bin/env npx tsx
/**
 * One-off: recompute county PropertyIQ scores for 2026-03-31 (month-end).
 *
 * Mirrors ScoringService.calculateV4Scores('county', '2026-03-31') exactly,
 * but runs standalone (no NestJS bootstrap) by reusing the real production
 * code paths: the v4 fetcher, the pure v4 engine, and the persistence upsert.
 *
 * Writes to propertyiq_scores via upsert on
 * (geography, location_id, score_type, score_date) — overwrites the existing
 * 2026-03-31 county rows and inserts newly-keyable counties. Reversible via
 * backup_piq_scores_county_20260331.
 */

import { getSupabaseClient } from "./lib/db-client";
import { fetchPropertyIqMetrics } from "../packages/backend/src/scoring/propertyiq-data-fetcher";
import { calculatePropertyIqScores } from "../packages/backend/src/scoring/propertyiq-scoring-engine";

// NOTE: persistence helper writes to the `propertyiq_scores` VIEW (un-upsertable);
// the real base table is `propertyiq_scores_v2` with unique
// (geography, location_id, score_type, score_date). We upsert there directly.
const TARGET_TABLE = "propertyiq_scores_v2";

const GEOGRAPHY = "county" as const;

// 12 month-ends to re-score (2025-04 .. 2026-03). Matches redfin period_end.
const SCORE_DATES = [
  "2025-04-30",
  "2025-05-31",
  "2025-06-30",
  "2025-07-31",
  "2025-08-31",
  "2025-09-30",
  "2025-10-31",
  "2025-11-30",
  "2025-12-31",
  "2026-01-31",
  "2026-02-28",
  "2026-03-31",
];

async function rescoreMonth(
  supabase: ReturnType<typeof getSupabaseClient>,
  scoreDate: string,
): Promise<number> {
  const locations = await fetchPropertyIqMetrics(
    supabase,
    GEOGRAPHY,
    scoreDate,
  );
  const results = calculatePropertyIqScores(locations, GEOGRAPHY);

  const createdAt = new Date().toISOString();
  const rows = results.map((r) => ({
    geography: GEOGRAPHY,
    location_id: r.locationId,
    location_name: r.locationName,
    score_type: "propertyiq" as const,
    score: r.score,
    grade: r.grade,
    confidence: r.confidence,
    confidence_level: r.confidenceLevel,
    median_price: r.medianPrice,
    score_date: scoreDate,
    created_at: createdAt,
    z_scores: JSON.stringify(r.inputMetrics),
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(TARGET_TABLE).upsert(slice, {
      onConflict: "geography,location_id,score_type,score_date",
    });
    if (error) {
      throw new Error(`upsert ${scoreDate} batch ${i}: ${error.message}`);
    }
  }
  return rows.length;
}

async function main() {
  const supabase = getSupabaseClient();
  for (const scoreDate of SCORE_DATES) {
    const n = await rescoreMonth(supabase, scoreDate);
    console.log(`  ${scoreDate}: wrote ${n} county scores`);
  }
  console.log(`Done. Re-scored ${SCORE_DATES.length} months.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
