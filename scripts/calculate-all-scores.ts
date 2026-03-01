/**
 * Calculate and store all PropertyIQ scores for all geographies.
 * Uses z-score methodology: z-score -> weighted formula -> 0-100 normalization.
 *
 * Saves to propertyiq_scores_v2 (normalized schema).
 * Handles large datasets with pagination.
 *
 * Usage:
 *   npx tsx scripts/calculate-all-scores.ts              # Latest period only
 *   npx tsx scripts/calculate-all-scores.ts --backfill   # All periods from 2020-01-01
 *   npx tsx scripts/calculate-all-scores.ts --from 2022-06-01  # Custom start date
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

import {
  type ScoreType,
  type GeoLevel,
  FORMULA_WEIGHTS,
  scoreToGrade,
  getConfidenceLevel,
} from "./calculations/score-formula-weights";
import {
  calculateZScores,
  applyFormulaAndNormalize,
} from "./calculations/score-zscore-engine";
import {
  type ScoreGeoConfig,
  SCORE_GEO_CONFIGS,
  getLatestPeriodDate,
  getAllPeriodDates,
  fetchAllDataForGeo,
} from "./calculations/score-data-fetcher";

// ---------------------------------------------------------------------------
// Supabase client initialization
// ---------------------------------------------------------------------------

dotenv.config({ path: path.resolve(process.cwd(), "packages/backend/.env") });

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Score batch insert
// ---------------------------------------------------------------------------

async function insertScoresBatch(
  records: any[],
  batchSize = 500,
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from("propertyiq_scores_v2")
      .upsert(batch, {
        onConflict: "geography,location_id,score_type,score_date",
      });

    if (error) {
      errors += batch.length;
      if (i === 0) console.error(`  Batch error: ${error.message}`);
    } else {
      success += batch.length;
    }
  }

  return { success, errors };
}

// ---------------------------------------------------------------------------
// Per-geography score calculation
// ---------------------------------------------------------------------------

async function calculateScoresForGeo(
  config: ScoreGeoConfig,
  periodDate: string,
): Promise<{ processed: number; errors: number }> {
  const data = await fetchAllDataForGeo(supabase, config, periodDate);
  if (data.length === 0) return { processed: 0, errors: 0 };

  const validData = data.filter(
    (d) =>
      d.hotness_score != null ||
      d.pending_ratio != null ||
      d.demand_score != null,
  );
  if (validData.length === 0) return { processed: 0, errors: 0 };

  const formulas = FORMULA_WEIGHTS[config.geoLevel];
  const scoreTypes: ScoreType[] = ["homeready", "investoredge", "markethealth"];
  const allScoreRecords: any[] = [];

  for (const scoreType of scoreTypes) {
    const formula = formulas[scoreType];
    const metricNames = Object.keys(formula);
    const zScores = calculateZScores(validData, metricNames, "id");
    const scores = applyFormulaAndNormalize(
      validData,
      zScores,
      formula,
      "id",
      config.geoLevel,
      scoreType,
    );

    for (const record of validData) {
      const scoreData = scores.get(record.id);
      if (!scoreData) continue;

      allScoreRecords.push({
        geography: config.geoLevel,
        location_id: record.id,
        location_name: record.name,
        score_type: scoreType,
        score: scoreData.score,
        grade: scoreToGrade(scoreData.score),
        confidence: scoreData.confidence,
        confidence_level: getConfidenceLevel(scoreData.confidence),
        median_price: record.median_price,
        score_date: periodDate,
      });
    }
  }

  const result = await insertScoresBatch(allScoreRecords);
  return { processed: result.success, errors: result.errors };
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

async function calculateAllForPeriod(
  periodDate: string,
): Promise<{ processed: number; errors: number }> {
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const config of SCORE_GEO_CONFIGS) {
    const result = await calculateScoresForGeo(config, periodDate);
    totalProcessed += result.processed;
    totalErrors += result.errors;
  }

  return { processed: totalProcessed, errors: totalErrors };
}

async function main() {
  const args = process.argv.slice(2);
  const isBackfill = args.includes("--backfill");
  const fromIdx = args.indexOf("--from");
  const startDate =
    fromIdx !== -1 ? args[fromIdx + 1] : isBackfill ? "2020-01-01" : null;

  console.log("PROPERTYIQ SCORE CALCULATION - Z-SCORE METHODOLOGY\n");

  let periodDates: string[];

  if (startDate) {
    console.log(`Backfill mode: fetching all periods from ${startDate}...\n`);
    periodDates = await getAllPeriodDates(supabase, "realtor_metro", startDate);
    console.log(`Found ${periodDates.length} periods to process\n`);
  } else {
    const latest = await getLatestPeriodDate(supabase, "realtor_metro");
    if (!latest) {
      console.error("No realtor data found");
      process.exit(1);
    }
    periodDates = [latest];
    console.log(`Period date: ${latest}\n`);
  }

  let grandTotal = 0;
  let grandErrors = 0;
  const overallStart = Date.now();

  for (let i = 0; i < periodDates.length; i++) {
    const pd = periodDates[i];
    const tag =
      periodDates.length > 1 ? `[${i + 1}/${periodDates.length}] ` : "";
    process.stdout.write(`${tag}${pd}: `);

    const { processed, errors } = await calculateAllForPeriod(pd);
    grandTotal += processed;
    grandErrors += errors;

    console.log(
      `${processed.toLocaleString()} scores${errors ? ` (${errors} errors)` : ""}`,
    );
  }

  const elapsed = ((Date.now() - overallStart) / 1000).toFixed(0);
  console.log(
    `\nDone: ${grandTotal.toLocaleString()} scores saved in ${elapsed}s`,
  );
  if (grandErrors > 0) console.log(`Errors: ${grandErrors.toLocaleString()}`);

  const { count } = await supabase
    .from("propertyiq_scores_v2")
    .select("*", { count: "exact", head: true });
  console.log(
    `Total records in propertyiq_scores_v2: ${count?.toLocaleString()}`,
  );
}

main().catch(console.error);
