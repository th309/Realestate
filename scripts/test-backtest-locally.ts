/**
 * Test Backtest Analysis Locally
 * 
 * This script tests the backtesting logic using the real Supabase database.
 * It validates that high scores outperform benchmarks and low scores underperform.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DecileStats {
  decile: string;
  scoreMin: number;
  scoreMax: number;
  avgActualReturn: number;
  avgExcessReturn: number;
  observations: number;
  stdDev: number;
  beatsBenchmark: boolean;
}

async function runBacktestAnalysis(
  scoreType: string = 'investoredge',
  geoType: string = 'metro',
  horizonMonths: number = 12
) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`BACKTEST ANALYSIS: ${scoreType.toUpperCase()} SCORE`);
  console.log(`Geography: ${geoType} | Horizon: ${horizonMonths} months`);
  console.log(`${'='.repeat(70)}\n`);

  const scoreCol = `${scoreType}_score`;
  const outcomeCol = `actual_appreciation_${horizonMonths}m`;

  // Fetch data
  console.log('Fetching data...');
  const { data, error, count } = await supabase
    .from('propertyiq_scores_history')
    .select(`${scoreCol}, ${outcomeCol}`, { count: 'exact' })
    .eq('geography_type', geoType)
    .not(scoreCol, 'is', null)
    .not(outcomeCol, 'is', null)
    .limit(100000);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data found with both score and outcome.');
    return;
  }

  console.log(`Loaded ${data.length.toLocaleString()} records (of ${count?.toLocaleString() || '?'} total)\n`);

  // Extract scores and outcomes
  const records = data.map(d => ({
    score: d[scoreCol] as number,
    outcome: d[outcomeCol] as number,
  })).filter(r => r.score !== null && r.outcome !== null);

  // Calculate benchmark (mean of all outcomes)
  const outcomes = records.map(r => r.outcome);
  const benchmark = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;

  console.log(`Benchmark (mean return): ${(benchmark * 100).toFixed(2)}%\n`);

  // Create deciles
  const decileBins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const decileLabels = ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100'];

  const decileStats: DecileStats[] = [];

  for (let i = 0; i < decileBins.length - 1; i++) {
    const low = decileBins[i];
    const high = decileBins[i + 1];
    const label = decileLabels[i];

    const decileRecords = records.filter(r => {
      if (i === decileBins.length - 2) {
        return r.score >= low && r.score <= high;
      }
      return r.score >= low && r.score < high;
    });

    if (decileRecords.length < 10) continue;

    const decileOutcomes = decileRecords.map(r => r.outcome);
    const avgReturn = decileOutcomes.reduce((a, b) => a + b, 0) / decileOutcomes.length;
    const excessReturn = avgReturn - benchmark;
    
    // Standard deviation
    const variance = decileOutcomes.reduce((sum, o) => sum + Math.pow(o - avgReturn, 2), 0) / (decileOutcomes.length - 1);
    const stdDev = Math.sqrt(variance);

    decileStats.push({
      decile: label,
      scoreMin: low,
      scoreMax: high,
      avgActualReturn: avgReturn,
      avgExcessReturn: excessReturn,
      observations: decileRecords.length,
      stdDev,
      beatsBenchmark: excessReturn > 0,
    });
  }

  // Print results table
  console.log('SCORE DECILE PERFORMANCE');
  console.log('-'.repeat(90));
  console.log('Score     | Actual Return | Benchmark | Excess Return | Observations | Beats?');
  console.log('-'.repeat(90));

  for (const d of decileStats) {
    const actual = (d.avgActualReturn * 100).toFixed(2).padStart(6);
    const bench = (benchmark * 100).toFixed(2).padStart(6);
    const excess = (d.avgExcessReturn * 100).toFixed(2).padStart(6);
    const obs = d.observations.toString().padStart(10);
    const beats = d.beatsBenchmark ? '✓ YES' : '✗ NO';

    console.log(`${d.decile.padEnd(9)} |     ${actual}%   |   ${bench}% |      ${excess}%  | ${obs}    | ${beats}`);
  }
  console.log('-'.repeat(90));

  // Summary
  const topDecile = decileStats[decileStats.length - 1];
  const bottomDecile = decileStats[0];
  const spread = topDecile.avgExcessReturn - bottomDecile.avgExcessReturn;

  console.log('\nSUMMARY:');
  console.log(`  Top Decile (91-100) Excess Return: ${(topDecile.avgExcessReturn * 100).toFixed(2)}%`);
  console.log(`  Bottom Decile (0-10) Excess Return: ${(bottomDecile.avgExcessReturn * 100).toFixed(2)}%`);
  console.log(`  Spread (Top - Bottom): ${(spread * 100).toFixed(2)}%`);

  // Correlation
  const scores = records.map(r => r.score);
  const n = scores.length;
  const meanScore = scores.reduce((a, b) => a + b, 0) / n;
  const meanOutcome = benchmark;
  
  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = scores[i] - meanScore;
    const dy = outcomes[i] - meanOutcome;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }
  const correlation = sumXY / Math.sqrt(sumX2 * sumY2);
  const rSquared = correlation * correlation;

  console.log(`  Pearson Correlation: ${correlation.toFixed(4)}`);
  console.log(`  R-squared: ${rSquared.toFixed(4)}`);

  // Validation
  const validated = topDecile.beatsBenchmark && !bottomDecile.beatsBenchmark && spread > 0.01;
  console.log(`\nVALIDATION: ${validated ? '✓ PASSED' : '✗ FAILED'}`);
  
  if (validated) {
    console.log(`  High ${scoreType} scores BEAT the benchmark`);
    console.log(`  Low ${scoreType} scores TRAIL the benchmark`);
    console.log(`  Score has predictive power for relative performance`);
  } else {
    console.log(`  Score validation criteria not met`);
    if (!topDecile.beatsBenchmark) console.log(`    - Top decile does not beat benchmark`);
    if (bottomDecile.beatsBenchmark) console.log(`    - Bottom decile beats benchmark (unexpected)`);
    if (spread <= 0.01) console.log(`    - Spread too small (<1%)`);
  }

  return {
    validated,
    spread,
    topExcess: topDecile.avgExcessReturn,
    bottomExcess: bottomDecile.avgExcessReturn,
    correlation,
    rSquared,
    sampleSize: records.length,
  };
}

async function main() {
  console.log('PropertyIQ Score Backtesting Analysis');
  console.log('=====================================\n');
  console.log('This test validates that PropertyIQ scores identify');
  console.log('markets that beat (or trail) the benchmark.\n');

  // Test InvestorEdge
  const investorResult = await runBacktestAnalysis('investoredge', 'metro', 12);

  // Test HomeReady
  const homereadyResult = await runBacktestAnalysis('homeready', 'metro', 12);

  // Also test 36-month horizon
  console.log('\n\n--- Testing 36-month horizon ---\n');
  await runBacktestAnalysis('investoredge', 'metro', 36);

  console.log('\n\n=== FINAL SUMMARY ===');
  console.log('InvestorEdge:', investorResult?.validated ? 'VALIDATED ✓' : 'NOT VALIDATED ✗');
  console.log('HomeReady:', homereadyResult?.validated ? 'VALIDATED ✓' : 'NOT VALIDATED ✗');
}

main().catch(console.error);
