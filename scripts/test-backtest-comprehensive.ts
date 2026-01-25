/**
 * Comprehensive Backtest Analysis
 * 
 * Tests PropertyIQ score validation with larger samples across multiple geographies and horizons.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AnalysisResult {
  scoreType: string;
  geoType: string;
  horizon: number;
  sampleSize: number;
  benchmark: number;
  topDecileExcess: number;
  bottomDecileExcess: number;
  spread: number;
  correlation: number;
  validated: boolean;
}

async function analyzeBacktest(
  scoreType: string,
  geoType: string,
  horizonMonths: number,
  sampleLimit: number = 50000
): Promise<AnalysisResult | null> {
  const scoreCol = `${scoreType}_score`;
  const outcomeCol = `actual_appreciation_${horizonMonths}m`;

  // Fetch data with random sampling
  const { data, error } = await supabase
    .from('propertyiq_scores_history')
    .select(`${scoreCol}, ${outcomeCol}`)
    .eq('geography_type', geoType)
    .not(scoreCol, 'is', null)
    .not(outcomeCol, 'is', null)
    .limit(sampleLimit);

  if (error || !data || data.length < 100) {
    return null;
  }

  const records = data.map(d => ({
    score: d[scoreCol] as number,
    outcome: d[outcomeCol] as number,
  })).filter(r => r.score !== null && r.outcome !== null);

  if (records.length < 100) return null;

  // Calculate benchmark
  const outcomes = records.map(r => r.outcome);
  const benchmark = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;

  // Calculate by quintile (5 buckets) for more samples per bucket
  const sorted = [...records].sort((a, b) => a.score - b.score);
  const quintileSize = Math.floor(sorted.length / 5);

  const quintiles: { avgScore: number; avgOutcome: number; count: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const start = i * quintileSize;
    const end = i === 4 ? sorted.length : (i + 1) * quintileSize;
    const quintileRecords = sorted.slice(start, end);
    
    quintiles.push({
      avgScore: quintileRecords.reduce((a, r) => a + r.score, 0) / quintileRecords.length,
      avgOutcome: quintileRecords.reduce((a, r) => a + r.outcome, 0) / quintileRecords.length,
      count: quintileRecords.length,
    });
  }

  const topQuintile = quintiles[4];
  const bottomQuintile = quintiles[0];
  const topExcess = topQuintile.avgOutcome - benchmark;
  const bottomExcess = bottomQuintile.avgOutcome - benchmark;
  const spread = topExcess - bottomExcess;

  // Correlation
  const scores = records.map(r => r.score);
  const n = scores.length;
  const meanScore = scores.reduce((a, b) => a + b, 0) / n;
  
  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = scores[i] - meanScore;
    const dy = outcomes[i] - benchmark;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }
  const correlation = sumXY / Math.sqrt(sumX2 * sumY2);

  // Validation: top beats benchmark, bottom trails, spread > 1%
  const validated = topExcess > 0 && bottomExcess < 0 && spread > 0.01;

  return {
    scoreType,
    geoType,
    horizon: horizonMonths,
    sampleSize: records.length,
    benchmark,
    topDecileExcess: topExcess,
    bottomDecileExcess: bottomExcess,
    spread,
    correlation,
    validated,
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║             PROPERTYIQ COMPREHENSIVE BACKTEST VALIDATION                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('║  Testing if high scores beat benchmarks and low scores trail benchmarks      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const scoreTypes = ['investoredge', 'homeready'];
  const geoTypes = ['metro', 'county', 'zip'];
  const horizons = [12, 36, 60];

  const results: AnalysisResult[] = [];

  // Run all combinations
  for (const scoreType of scoreTypes) {
    for (const geoType of geoTypes) {
      for (const horizon of horizons) {
        process.stdout.write(`Testing ${scoreType} / ${geoType} / ${horizon}m... `);
        
        const result = await analyzeBacktest(scoreType, geoType, horizon);
        
        if (result) {
          results.push(result);
          const status = result.validated ? '✓' : '✗';
          console.log(`${status} (n=${result.sampleSize.toLocaleString()}, spread=${(result.spread * 100).toFixed(1)}%)`);
        } else {
          console.log('insufficient data');
        }
      }
    }
  }

  // Print detailed results table
  console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('DETAILED RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('Score Type    | Geo    | Horizon | Sample    | Benchmark | Top Excess | Bot Excess | Spread  | r      | Valid');
  console.log('──────────────────────────────────────────────────────────────────────────────────────────────────────────────');

  for (const r of results) {
    const scoreType = r.scoreType.padEnd(12);
    const geo = r.geoType.padEnd(6);
    const horizon = `${r.horizon}m`.padEnd(7);
    const sample = r.sampleSize.toLocaleString().padStart(9);
    const bench = `${(r.benchmark * 100).toFixed(1)}%`.padStart(9);
    const topEx = `${r.topDecileExcess >= 0 ? '+' : ''}${(r.topDecileExcess * 100).toFixed(1)}%`.padStart(10);
    const botEx = `${r.bottomDecileExcess >= 0 ? '+' : ''}${(r.bottomDecileExcess * 100).toFixed(1)}%`.padStart(10);
    const spread = `${(r.spread * 100).toFixed(1)}%`.padStart(7);
    const corr = r.correlation.toFixed(3).padStart(6);
    const valid = r.validated ? '✓ YES' : '✗ NO';

    console.log(`${scoreType} | ${geo} | ${horizon} | ${sample} | ${bench} | ${topEx} | ${botEx} | ${spread} | ${corr} | ${valid}`);
  }

  // Summary by score type
  console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY BY SCORE TYPE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  for (const scoreType of scoreTypes) {
    const scoreResults = results.filter(r => r.scoreType === scoreType);
    const validCount = scoreResults.filter(r => r.validated).length;
    const avgSpread = scoreResults.reduce((a, r) => a + r.spread, 0) / scoreResults.length;
    const avgCorr = scoreResults.reduce((a, r) => a + r.correlation, 0) / scoreResults.length;

    console.log(`${scoreType.toUpperCase()}:`);
    console.log(`  Validated: ${validCount}/${scoreResults.length} combinations`);
    console.log(`  Avg Spread: ${(avgSpread * 100).toFixed(2)}%`);
    console.log(`  Avg Correlation: ${avgCorr.toFixed(4)}`);
    
    if (validCount >= scoreResults.length / 2) {
      console.log(`  STATUS: ✓ SCORE HAS PREDICTIVE POWER\n`);
    } else if (validCount > 0) {
      console.log(`  STATUS: ~ PARTIAL VALIDATION (some conditions)\n`);
    } else {
      console.log(`  STATUS: ✗ SCORE LACKS PREDICTIVE POWER\n`);
    }
  }

  // Overall conclusion
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('OVERALL CONCLUSION');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const totalValidated = results.filter(r => r.validated).length;
  const totalTests = results.length;
  
  console.log(`Total tests: ${totalTests}`);
  console.log(`Validated: ${totalValidated} (${((totalValidated / totalTests) * 100).toFixed(0)}%)`);

  if (totalValidated >= totalTests * 0.6) {
    console.log('\n✓ SCORES ARE VALIDATED');
    console.log('  PropertyIQ scores successfully identify relative opportunities');
    console.log('  that beat the market benchmark.');
  } else if (totalValidated >= totalTests * 0.3) {
    console.log('\n~ PARTIAL VALIDATION');
    console.log('  Scores show some predictive power but inconsistently.');
    console.log('  Consider reviewing formula weights or data quality.');
  } else {
    console.log('\n✗ VALIDATION FAILED');
    console.log('  Scores do not reliably predict benchmark-beating performance.');
    console.log('  Formula weights may need recalibration.');
  }
}

main().catch(console.error);
