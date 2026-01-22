/**
 * Full integration test - calculates percentiles and scores with real data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Metric ranges from Implementation Guide for min-max normalization
const METRIC_RANGES: Record<string, { min: number; max: number; invert?: boolean }> = {
  median_days_on_market: { min: 10, max: 120 },
  pending_ratio: { min: 0.1, max: 0.8 },
  price_reduced_share: { min: 0, max: 40 },
  active_listing_count_yy: { min: -50, max: 50 },
  median_listing_price_yy: { min: -20, max: 30 },
};

function normalizeMinMax(value: number, min: number, max: number, invert = false): number {
  const clamped = Math.max(min, Math.min(max, value));
  let normalized = ((clamped - min) / (max - min)) * 100;
  if (invert) normalized = 100 - normalized;
  return Math.round(normalized * 100) / 100;
}

async function main() {
  console.log('=== Full Scoring Pipeline Test ===\n');

  // Step 1: Get latest date and state data
  const { data: stateData } = await supabase
    .from('realtor_state')
    .select('*')
    .order('period_date', { ascending: false });

  if (!stateData || stateData.length === 0) {
    console.error('No state data found');
    return;
  }

  const latestDate = stateData[0].period_date;
  const statesForDate = stateData.filter(s => s.period_date === latestDate);
  console.log(`Found ${statesForDate.length} states for ${latestDate}\n`);

  // Step 2: Calculate percentiles for key metrics
  console.log('Step 1: Calculating percentiles...');

  const metricsToCalculate = ['median_days_on_market', 'pending_ratio', 'price_reduced_share', 'active_listing_count_yy'];
  const percentiles: Record<string, { p10: number; p50: number; p90: number; min: number; max: number }> = {};

  for (const metric of metricsToCalculate) {
    const values = statesForDate
      .map(s => s[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length >= 5) {
      const getP = (arr: number[], p: number) => arr[Math.floor((p / 100) * arr.length)];
      percentiles[metric] = {
        p10: getP(values, 10),
        p50: getP(values, 50),
        p90: getP(values, 90),
        min: values[0],
        max: values[values.length - 1],
      };
      console.log(`   ${metric}: p10=${percentiles[metric].p10}, p50=${percentiles[metric].p50}, p90=${percentiles[metric].p90}`);

      // Save to database
      await supabase.from('metric_percentiles').upsert({
        metric_name: metric,
        geography_type: 'state',
        period_date: latestDate,
        p10: percentiles[metric].p10,
        p20: getP(values, 20),
        p30: getP(values, 30),
        p40: getP(values, 40),
        p50: percentiles[metric].p50,
        p60: getP(values, 60),
        p70: getP(values, 70),
        p80: getP(values, 80),
        p90: percentiles[metric].p90,
        min_value: percentiles[metric].min,
        max_value: percentiles[metric].max,
        count_values: values.length,
        mean_value: values.reduce((a, b) => a + b, 0) / values.length,
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'metric_name,geography_type,period_date' });
    }
  }

  // Step 3: Calculate scores for each state
  console.log('\nStep 2: Calculating scores for each state...');
  console.log('(Using min-max normalization based on Implementation Guide ranges)\n');

  const scores: Array<{ state: string; domScore: number; pendingScore: number; combinedScore: number }> = [];

  for (const state of statesForDate) {
    const dom = state.median_days_on_market;
    const pending = state.pending_ratio;

    if (dom === null || pending === null) continue;

    // For Market Health - lower DOM is better (more demand)
    const domScore = normalizeMinMax(dom, 10, 120, true); // Invert: lower DOM = higher score
    // Higher pending ratio is better (more demand)
    const pendingScore = normalizeMinMax(pending, 0.1, 0.8);

    // Simple combined score (equal weight)
    const combinedScore = Math.round((domScore + pendingScore) / 2 * 100) / 100;

    scores.push({
      state: state.state_id,
      domScore,
      pendingScore,
      combinedScore,
    });
  }

  // Sort by combined score
  scores.sort((a, b) => b.combinedScore - a.combinedScore);

  // Step 4: Show results
  console.log('Top 10 States (by combined demand score):');
  console.log('State | DOM Score | Pending Score | Combined');
  console.log('------|-----------|---------------|----------');
  for (const s of scores.slice(0, 10)) {
    console.log(`  ${s.state}  |    ${s.domScore.toFixed(1).padStart(5)}  |       ${s.pendingScore.toFixed(1).padStart(5)}  |   ${s.combinedScore.toFixed(1)}`);
  }

  console.log('\nBottom 10 States:');
  console.log('State | DOM Score | Pending Score | Combined');
  console.log('------|-----------|---------------|----------');
  for (const s of scores.slice(-10)) {
    console.log(`  ${s.state}  |    ${s.domScore.toFixed(1).padStart(5)}  |       ${s.pendingScore.toFixed(1).padStart(5)}  |   ${s.combinedScore.toFixed(1)}`);
  }

  // Step 5: Verify variation
  const allScores = scores.map(s => s.combinedScore);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const stdDev = Math.sqrt(allScores.map(s => Math.pow(s - avgScore, 2)).reduce((a, b) => a + b, 0) / allScores.length);

  console.log('\n=== Score Distribution ===');
  console.log(`Min: ${minScore.toFixed(1)}`);
  console.log(`Max: ${maxScore.toFixed(1)}`);
  console.log(`Range: ${(maxScore - minScore).toFixed(1)} points`);
  console.log(`Avg: ${avgScore.toFixed(1)}`);
  console.log(`StdDev: ${stdDev.toFixed(1)}`);

  if (maxScore - minScore < 5) {
    console.log('\n⚠️ WARNING: Score range is very small - scores may not be differentiating well');
  } else {
    console.log('\n✓ Scores show good variation across states');
  }

  // Verify percentiles were saved
  const { count } = await supabase
    .from('metric_percentiles')
    .select('*', { count: 'exact', head: true })
    .eq('geography_type', 'state')
    .eq('period_date', latestDate);

  console.log(`\n✓ Saved ${count} percentile records to database`);
}

main().catch(console.error);
