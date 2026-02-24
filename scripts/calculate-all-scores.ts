/**
 * Calculate and store all PropertyIQ scores for all geographies.
 * Uses z-score methodology: z-score -> weighted formula -> 0-100 normalization.
 *
 * Saves to propertyiq_scores_v2 (normalized schema).
 * Handles large datasets with pagination.
 *
 * Usage: npx tsx scripts/calculate-all-scores.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

import {
  type ScoreType,
  type GeoLevel,
  FORMULA_WEIGHTS,
  scoreToGrade,
  getConfidenceLevel,
} from './calculations/score-formula-weights';
import { calculateZScores, applyFormulaAndNormalize } from './calculations/score-zscore-engine';
import {
  type ScoreGeoConfig,
  SCORE_GEO_CONFIGS,
  getLatestPeriodDate,
  fetchAllDataForGeo,
} from './calculations/score-data-fetcher';

// ---------------------------------------------------------------------------
// Supabase client initialization
// ---------------------------------------------------------------------------

dotenv.config({ path: path.resolve(process.cwd(), 'packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
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
      .from('propertyiq_scores_v2')
      .upsert(batch, { onConflict: 'geography,location_id,score_type,score_date' });

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

  const validData = data.filter(d =>
    d.hotness_score != null || d.pending_ratio != null || d.demand_score != null
  );
  if (validData.length === 0) return { processed: 0, errors: 0 };

  const formulas = FORMULA_WEIGHTS[config.geoLevel];
  const scoreTypes: ScoreType[] = ['homeready', 'investoredge', 'markethealth'];
  const allScoreRecords: any[] = [];

  for (const scoreType of scoreTypes) {
    const formula = formulas[scoreType];
    const metricNames = Object.keys(formula);
    const zScores = calculateZScores(validData, metricNames, 'id');
    const scores = applyFormulaAndNormalize(validData, zScores, formula, 'id', config.geoLevel, scoreType);

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

async function main() {
  console.log('PROPERTYIQ SCORE CALCULATION - Z-SCORE METHODOLOGY\n');

  const periodDate = await getLatestPeriodDate(supabase, 'realtor_metro');
  if (!periodDate) {
    console.error('No realtor data found');
    process.exit(1);
  }

  console.log(`Period date: ${periodDate}\n`);
  console.log('CALCULATING SCORES FOR ALL GEOGRAPHIES\n');

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const config of SCORE_GEO_CONFIGS) {
    const startTime = Date.now();
    process.stdout.write(`  ${config.geoLevel.padEnd(8)}: fetching data... `);

    const result = await calculateScoresForGeo(config, periodDate);
    totalProcessed += result.processed;
    totalErrors += result.errors;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`${result.processed} scores saved (${elapsed}s)`);
  }

  console.log(`\n  Total: ${totalProcessed} scores saved`);
  if (totalErrors > 0) console.log(`  Errors: ${totalErrors}`);

  // Summary counts
  console.log('\nSUMMARY\n');

  const { count: v2Count } = await supabase
    .from('propertyiq_scores_v2')
    .select('*', { count: 'exact', head: true });

  console.log(`  propertyiq_scores_v2: ${v2Count?.toLocaleString()} total records`);

  console.log('\n  Current period breakdown:');
  for (const geoLevel of ['metro', 'county', 'zip'] as GeoLevel[]) {
    const { count } = await supabase
      .from('propertyiq_scores_v2')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geoLevel)
      .eq('score_date', periodDate);
    console.log(`    ${geoLevel.padEnd(8)}: ${count?.toLocaleString() || 0}`);
  }

  // Top 5 per score type
  console.log('\nTOP 5 MARKETS BY SCORE');
  for (const scoreType of ['homeready', 'investoredge', 'markethealth']) {
    const { data: topMarkets } = await supabase
      .from('propertyiq_scores_v2')
      .select('location_name, score, grade')
      .eq('geography', 'metro')
      .eq('score_type', scoreType)
      .eq('score_date', periodDate)
      .order('score', { ascending: false })
      .limit(5);

    console.log(`\n  ${scoreType.toUpperCase()} (Metro):`);
    if (topMarkets) {
      for (const m of topMarkets) {
        const name = (m.location_name || '').substring(0, 40).padEnd(40);
        console.log(`     ${m.score.toFixed(1)} ${m.grade.padEnd(3)} ${name}`);
      }
    }
  }

  console.log('\nScore calculation complete. Saved to propertyiq_scores_v2.');
}

main().catch(console.error);
