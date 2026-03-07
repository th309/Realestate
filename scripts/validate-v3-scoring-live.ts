/**
 * v3.0 Scoring Live Validation Script
 *
 * Tests all 9 score combinations (3 geos × 3 scores) against live Supabase data.
 * Samples 30 locations per unique formula (7 unique due to county/zip HR=IE duplication)
 * for a total of 210 validated scores.
 *
 * Usage: npx ts-node -P packages/backend/tsconfig.json scripts/validate-v3-scoring-live.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load backend env
dotenv.config({ path: path.resolve(__dirname, "../packages/backend/.env") });

import {
  FORMULA_WEIGHTS,
  FORMULA_VERSION,
  validateFormulaWeights,
  scoreToGrade,
  GeographyLevel,
  ScoreType,
} from "../packages/backend/src/scoring/formula-weights";
import {
  getLatestRedfinDate,
  fetchAllMetrics,
} from "../packages/backend/src/scoring/scoring-data-fetcher";
import {
  getAllMetricNames,
  calculateZScores,
  applyFormula,
  normalizeScores,
  calculateConfidence,
} from "../packages/backend/src/scoring/scoring-engine";

// ============================================================================
// Config
// ============================================================================

const SAMPLE_SIZE = 30;
const GEOS: GeographyLevel[] = ["metro", "county", "zip"];
const SCORE_TYPES: ScoreType[] = ["homeready", "investoredge", "markethealth"];

// ============================================================================
// Main
// ============================================================================

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n========================================`);
  console.log(`  PropertyIQ Scoring v3.0 Live Validation`);
  console.log(`  Formula Version: ${FORMULA_VERSION}`);
  console.log(`========================================\n`);

  // Step 1: Validate formula weights sum to ~1.0
  console.log("--- Step 1: Formula Weight Validation ---\n");
  let allWeightsValid = true;
  for (const geo of GEOS) {
    for (const st of SCORE_TYPES) {
      const { valid, sum } = validateFormulaWeights(geo, st);
      const status = valid ? "PASS" : "FAIL";
      if (!valid) allWeightsValid = false;
      console.log(`  ${geo}/${st}: sum=${sum.toFixed(4)} [${status}]`);
    }
  }
  console.log(`\n  All weights valid: ${allWeightsValid ? "YES" : "NO"}\n`);

  // Step 2: Fetch data and score for each geography
  const results: ValidationResult[] = [];

  for (const geo of GEOS) {
    console.log(`--- Step 2: Fetching ${geo} data ---\n`);

    const latestDate = await getLatestRedfinDate(supabase, geo);
    if (!latestDate) {
      console.log(`  SKIP: No Redfin data found for ${geo}\n`);
      continue;
    }
    console.log(`  Latest Redfin date: ${latestDate}`);

    const allLocations = await fetchAllMetrics(supabase, geo, latestDate);
    console.log(`  Total locations fetched: ${allLocations.length}`);

    if (allLocations.length === 0) {
      console.log(`  SKIP: No locations found for ${geo}\n`);
      continue;
    }

    // Compute z-scores across ALL locations (needed for proper standardization)
    const allMetricNames = getAllMetricNames(geo);
    const zScores = calculateZScores(allLocations, allMetricNames);

    // Analyze data coverage
    console.log(`\n  Data coverage (all ${allLocations.length} locations):`);
    for (const metric of allMetricNames) {
      const count = allLocations.filter(
        (l) => (l as any)[metric] !== null && (l as any)[metric] !== undefined,
      ).length;
      const pct = ((count / allLocations.length) * 100).toFixed(1);
      console.log(`    ${metric}: ${count}/${allLocations.length} (${pct}%)`);
    }

    // Sample 30 locations (evenly spaced for representativeness)
    const sample = sampleLocations(allLocations, SAMPLE_SIZE);
    console.log(`\n  Sampled ${sample.length} locations for scoring\n`);

    // Score each type
    for (const st of SCORE_TYPES) {
      const formula = FORMULA_WEIGHTS[geo][st];
      const rawScores = applyFormula(allLocations, zScores, formula);
      const normalized = normalizeScores(rawScores);

      // Build lookup from all locations
      const scoreByLocationId = new Map<string, number>();
      for (let i = 0; i < allLocations.length; i++) {
        scoreByLocationId.set(allLocations[i].location_id, normalized[i]);
      }

      // Extract sample scores
      const sampleScores: ScoredLocation[] = [];
      for (const loc of sample) {
        const score = scoreByLocationId.get(loc.location_id);
        if (score === undefined) continue;

        const grade = scoreToGrade(score);
        const { confidence, level } = calculateConfidence(loc, geo, st);

        sampleScores.push({
          location_id: loc.location_id,
          location_name: loc.location_name,
          score,
          grade,
          confidence,
          confidence_level: level,
          metrics_available: countAvailableMetrics(loc, Object.keys(formula)),
          metrics_total: Object.keys(formula).length,
        });
      }

      // Validate
      const validation = validateScores(sampleScores, geo, st);
      results.push(validation);

      console.log(`  ${geo}/${st}:`);
      console.log(
        `    Scores: min=${validation.minScore.toFixed(1)}, max=${validation.maxScore.toFixed(1)}, mean=${validation.meanScore.toFixed(1)}, median=${validation.medianScore.toFixed(1)}`,
      );
      console.log(
        `    Confidence: min=${validation.minConfidence.toFixed(1)}, max=${validation.maxConfidence.toFixed(1)}, mean=${validation.meanConfidence.toFixed(1)}`,
      );
      console.log(
        `    Grades: ${JSON.stringify(validation.gradeDistribution)}`,
      );
      console.log(
        `    Confidence levels: ${JSON.stringify(validation.confidenceLevelDistribution)}`,
      );
      console.log(
        `    Data completeness: mean=${validation.meanCompleteness.toFixed(0)}%, min=${validation.minCompleteness.toFixed(0)}%`,
      );
      console.log(
        `    Issues: ${validation.issues.length === 0 ? "NONE" : validation.issues.join("; ")}`,
      );
      console.log();
    }
  }

  // Step 3: Summary
  console.log(`\n========================================`);
  console.log(`  SUMMARY`);
  console.log(`========================================\n`);

  let totalScored = 0;
  let totalIssues = 0;
  const allIssues: string[] = [];

  for (const r of results) {
    const status = r.issues.length === 0 ? "PASS" : "WARN";
    console.log(`  ${r.geo}/${r.scoreType}: ${r.count} scored [${status}]`);
    totalScored += r.count;
    totalIssues += r.issues.length;
    allIssues.push(...r.issues.map((i) => `${r.geo}/${r.scoreType}: ${i}`));
  }

  console.log(`\n  Total scored: ${totalScored}`);
  console.log(`  Total issues: ${totalIssues}`);

  if (allIssues.length > 0) {
    console.log(`\n  Issues:`);
    for (const issue of allIssues) {
      console.log(`    - ${issue}`);
    }
  }

  console.log(
    `\n  Result: ${totalIssues === 0 ? "ALL PASS" : "ISSUES FOUND"}\n`,
  );
  process.exit(totalIssues > 0 ? 1 : 0);
}

// ============================================================================
// Helpers
// ============================================================================

interface ScoredLocation {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
  confidence: number;
  confidence_level: string;
  metrics_available: number;
  metrics_total: number;
}

interface ValidationResult {
  geo: GeographyLevel;
  scoreType: ScoreType;
  count: number;
  minScore: number;
  maxScore: number;
  meanScore: number;
  medianScore: number;
  minConfidence: number;
  maxConfidence: number;
  meanConfidence: number;
  gradeDistribution: Record<string, number>;
  confidenceLevelDistribution: Record<string, number>;
  meanCompleteness: number;
  minCompleteness: number;
  issues: string[];
}

function sampleLocations(locations: any[], n: number): any[] {
  if (locations.length <= n) return locations;
  const step = Math.floor(locations.length / n);
  const sampled: any[] = [];
  for (let i = 0; i < n; i++) {
    sampled.push(locations[i * step]);
  }
  return sampled;
}

function countAvailableMetrics(location: any, metricNames: string[]): number {
  return metricNames.filter(
    (m) => location[m] !== null && location[m] !== undefined,
  ).length;
}

function validateScores(
  scores: ScoredLocation[],
  geo: GeographyLevel,
  scoreType: ScoreType,
): ValidationResult {
  const issues: string[] = [];
  const scoreValues = scores.map((s) => s.score);
  const confValues = scores.map((s) => s.confidence);

  const sorted = [...scoreValues].sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  const mean = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
  const confMean = confValues.reduce((a, b) => a + b, 0) / confValues.length;

  // Check: all scores in [0, 100]
  const outOfRange = scores.filter((s) => s.score < 0 || s.score > 100);
  if (outOfRange.length > 0) {
    issues.push(`${outOfRange.length} scores out of [0,100] range`);
  }

  // Check: scores aren't all the same (degenerate)
  const uniqueScores = new Set(scoreValues);
  if (uniqueScores.size < 3 && scores.length >= 10) {
    issues.push(
      `Only ${uniqueScores.size} unique score values — may be degenerate`,
    );
  }

  // Check: confidence values are reasonable (all >= 0)
  const badConf = confValues.filter((c) => c < 0 || c > 100);
  if (badConf.length > 0) {
    issues.push(`${badConf.length} confidence values out of [0,100] range`);
  }

  // Check: data completeness — warn if average < 50%
  const completeness = scores.map(
    (s) => (s.metrics_available / s.metrics_total) * 100,
  );
  const avgComplete =
    completeness.reduce((a, b) => a + b, 0) / completeness.length;
  const minComplete = Math.min(...completeness);
  if (avgComplete < 50) {
    issues.push(`Low avg data completeness: ${avgComplete.toFixed(0)}%`);
  }

  // Grade distribution
  const gradeDistribution: Record<string, number> = {};
  for (const s of scores) {
    gradeDistribution[s.grade] = (gradeDistribution[s.grade] || 0) + 1;
  }

  // Confidence level distribution
  const confLevelDist: Record<string, number> = {};
  for (const s of scores) {
    confLevelDist[s.confidence_level] =
      (confLevelDist[s.confidence_level] || 0) + 1;
  }

  return {
    geo,
    scoreType,
    count: scores.length,
    minScore: Math.min(...scoreValues),
    maxScore: Math.max(...scoreValues),
    meanScore: mean,
    medianScore: median,
    minConfidence: Math.min(...confValues),
    maxConfidence: Math.max(...confValues),
    meanConfidence: confMean,
    gradeDistribution,
    confidenceLevelDistribution: confLevelDist,
    meanCompleteness: avgComplete,
    minCompleteness: minComplete,
    issues,
  };
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
