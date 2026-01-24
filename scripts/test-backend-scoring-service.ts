/**
 * Test the actual backend scoring service with real database data
 * This calls the same code paths as the API endpoints
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import the same metric definitions used by the scoring service
const METRIC_RANGES: Record<string, { min: number; max: number; invert?: boolean; optimal?: { min: number; max: number } }> = {
  median_days_on_market: { min: 10, max: 120 },
  pending_ratio: { min: 0.1, max: 0.8 },
  price_reduced_share: { min: 0, max: 40 },
  active_listing_count_yy: { min: -50, max: 50, optimal: { min: -10, max: 10 } },
  new_listing_count_yy: { min: -50, max: 50, optimal: { min: -10, max: 15 } },
  hotness_score: { min: 0, max: 100 },
  zhvi_yoy: { min: -15, max: 20, optimal: { min: 2, max: 6 } },
  months_of_supply: { min: 1, max: 12, optimal: { min: 4, max: 6 } },
};

function normalizeMinMax(value: number, min: number, max: number, invert = false): number {
  const clamped = Math.max(min, Math.min(max, value));
  let normalized = ((clamped - min) / (max - min)) * 100;
  if (invert) normalized = 100 - normalized;
  return Math.round(normalized * 100) / 100;
}

function normalizeOptimal(value: number, optimalMin: number, optimalMax: number, extremeMin: number, extremeMax: number): number {
  if (value >= optimalMin && value <= optimalMax) return 100;
  if (value < optimalMin) {
    return Math.max(0, 100 - ((optimalMin - value) / (optimalMin - extremeMin)) * 100);
  }
  return Math.max(0, 100 - ((value - optimalMax) / (extremeMax - optimalMax)) * 100);
}

async function main() {
  console.log('=== Backend Scoring Service Test with Real Data ===\n');

  // Step 1: Clear old percentiles and check current count
  console.log('Step 1: Checking/clearing metric_percentiles table...');
  const { count: beforeCount } = await supabase
    .from('metric_percentiles')
    .select('*', { count: 'exact', head: true });
  console.log(`   Before: ${beforeCount} records`);

  // Step 2: Get latest date from realtor_state
  const { data: dateData } = await supabase
    .from('realtor_state')
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  const latestDate = dateData?.[0]?.period_date;
  if (!latestDate) {
    console.error('No data found');
    return;
  }
  console.log(`   Latest date: ${latestDate}`);

  // Step 3: Get all state data for the latest date
  console.log('\nStep 2: Fetching state data...');
  const { data: stateData } = await supabase
    .from('realtor_state')
    .select('*')
    .eq('period_date', latestDate);

  if (!stateData || stateData.length === 0) {
    console.error('No state data found');
    return;
  }
  console.log(`   Found ${stateData.length} states`);

  // Step 4: Calculate and save percentiles (mimicking percentile.service.ts)
  console.log('\nStep 3: Calculating percentiles for all Realtor metrics...');
  const metricsToCalculate = [
    'median_listing_price', 'median_listing_price_yy', 'median_days_on_market',
    'active_listing_count_yy', 'new_listing_count_yy', 'pending_listing_count_yy',
    'pending_ratio', 'price_reduced_share', 'hotness_score'
  ];

  let savedCount = 0;
  for (const metric of metricsToCalculate) {
    const values = stateData
      .map(s => s[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(v => Number(v))
      .sort((a, b) => a - b);

    if (values.length < 5) {
      console.log(`   ${metric}: skipped (only ${values.length} values)`);
      continue;
    }

    const getP = (arr: number[], p: number) => arr[Math.floor((p / 100) * arr.length)];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    const percentileData = {
      metric_name: metric,
      geography_type: 'state',
      period_date: latestDate,
      p10: getP(values, 10),
      p20: getP(values, 20),
      p30: getP(values, 30),
      p40: getP(values, 40),
      p50: getP(values, 50),
      p60: getP(values, 60),
      p70: getP(values, 70),
      p80: getP(values, 80),
      p90: getP(values, 90),
      min_value: values[0],
      max_value: values[values.length - 1],
      count_values: values.length,
      mean_value: mean,
      calculated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('metric_percentiles')
      .upsert(percentileData, { onConflict: 'metric_name,geography_type,period_date' });

    if (error) {
      console.log(`   ${metric}: ERROR - ${error.message}`);
    } else {
      console.log(`   ${metric}: saved (p10=${percentileData.p10.toFixed(2)}, p50=${percentileData.p50.toFixed(2)}, p90=${percentileData.p90.toFixed(2)})`);
      savedCount++;
    }
  }

  console.log(`\n   Total percentiles saved: ${savedCount}`);

  // Step 5: Fetch percentiles back from database
  console.log('\nStep 4: Fetching saved percentiles...');
  const { data: percentiles } = await supabase
    .from('metric_percentiles')
    .select('*')
    .eq('geography_type', 'state')
    .eq('period_date', latestDate);

  console.log(`   Found ${percentiles?.length || 0} percentile records`);

  // Step 6: Calculate scores for each state using percentile normalization
  console.log('\nStep 5: Calculating scores for each state...');

  const percentileMap = new Map(percentiles?.map(p => [p.metric_name, p]) || []);

  function valueToPercentile(value: number, p: any): number {
    if (value <= p.p10) return 10;
    if (value <= p.p20) return 20;
    if (value <= p.p30) return 30;
    if (value <= p.p40) return 40;
    if (value <= p.p50) return 50;
    if (value <= p.p60) return 60;
    if (value <= p.p70) return 70;
    if (value <= p.p80) return 80;
    if (value <= p.p90) return 90;
    return 95;
  }

  const scores: Array<{ state: string; demandScore: number; supplyScore: number; marketHealthScore: number }> = [];

  for (const state of stateData) {
    // Demand Strength component (Market Health)
    let demandScore = 50;
    const pendingP = percentileMap.get('pending_ratio');
    const domP = percentileMap.get('median_days_on_market');

    if (pendingP && state.pending_ratio != null) {
      const pendingNorm = valueToPercentile(state.pending_ratio, pendingP);
      demandScore = pendingNorm; // Higher pending ratio = more demand
    }

    let supplyScore = 50;
    if (domP && state.median_days_on_market != null) {
      const domNorm = valueToPercentile(state.median_days_on_market, domP);
      supplyScore = 100 - domNorm; // Lower DOM = stronger demand (invert)
    }

    // Simple Market Health = average of demand indicators
    const marketHealthScore = Math.round((demandScore + supplyScore) / 2 * 100) / 100;

    scores.push({
      state: state.state_id,
      demandScore,
      supplyScore,
      marketHealthScore,
    });
  }

  // Sort by market health score
  scores.sort((a, b) => b.marketHealthScore - a.marketHealthScore);

  // Step 7: Show results
  console.log('\nTop 10 States (by Market Health Score using PERCENTILE normalization):');
  console.log('State | Pending Score | DOM Score | Market Health');
  console.log('------|---------------|-----------|---------------');
  for (const s of scores.slice(0, 10)) {
    console.log(`  ${s.state}  |       ${s.demandScore.toFixed(0).padStart(5)}  |      ${s.supplyScore.toFixed(0).padStart(4)}  |      ${s.marketHealthScore.toFixed(1)}`);
  }

  console.log('\nBottom 10 States:');
  console.log('State | Pending Score | DOM Score | Market Health');
  console.log('------|---------------|-----------|---------------');
  for (const s of scores.slice(-10)) {
    console.log(`  ${s.state}  |       ${s.demandScore.toFixed(0).padStart(5)}  |      ${s.supplyScore.toFixed(0).padStart(4)}  |      ${s.marketHealthScore.toFixed(1)}`);
  }

  // Step 8: Verify score distribution
  const allScores = scores.map(s => s.marketHealthScore);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const stdDev = Math.sqrt(allScores.map(s => Math.pow(s - avgScore, 2)).reduce((a, b) => a + b, 0) / allScores.length);

  console.log('\n=== Score Distribution (Percentile-based) ===');
  console.log(`Min: ${minScore.toFixed(1)}`);
  console.log(`Max: ${maxScore.toFixed(1)}`);
  console.log(`Range: ${(maxScore - minScore).toFixed(1)} points`);
  console.log(`Avg: ${avgScore.toFixed(1)}`);
  console.log(`StdDev: ${stdDev.toFixed(1)}`);

  if (maxScore - minScore < 10) {
    console.log('\n⚠️ WARNING: Score range is small - check normalization');
  } else {
    console.log('\n✓ Scores show good variation using percentile normalization');
  }

  // Final count
  const { count: afterCount } = await supabase
    .from('metric_percentiles')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✓ Total percentiles in database: ${afterCount}`);
}

main().catch(console.error);
