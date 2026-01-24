/**
 * Run Backtest Analysis - Benchmark-Adjusted
 *
 * Analyzes PropertyIQ score predictions vs EXCESS returns (benchmark-adjusted):
 * - Correlation analysis (Pearson, Spearman) with excess returns
 * - Quintile analysis: Top quintile should BEAT benchmark, bottom should TRAIL
 * - Directional accuracy: High score -> positive excess return
 * - Confidence grade assignment based on benchmark-beating performance
 *
 * Three benchmark levels:
 * - National: US-wide average for geography type
 * - Regional: Parent geography average (ZIP->Metro, County->State)
 * - Peer Group: Similar geographies (price tier + density + region)
 *
 * Benchmark weights by score type:
 * - HomeReady: 20% national, 50% regional, 30% peer
 * - InvestorEdge: 20% national, 30% regional, 50% peer
 * - Market Health: 50% national, 30% regional, 20% peer
 *
 * Tests across multiple market windows:
 * - Pre-COVID (Jan 2018)
 * - COVID Entry (Jan 2020)
 * - Post-COVID Boom (Jan 2021)
 * - Rate Hike (Jan 2022)
 * - Recent (Jan 2024)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Score types to analyze
const SCORE_TYPES = ['investoredge', 'homeready', 'market_health'] as const;
type ScoreType = typeof SCORE_TYPES[number];

// Horizons to test (months)
const HORIZONS = [12, 24, 36, 60] as const;

// Benchmark weights by score type
const BENCHMARK_WEIGHTS: Record<ScoreType, { national: number; regional: number; peer: number }> = {
  homeready: { national: 0.20, regional: 0.50, peer: 0.30 },
  investoredge: { national: 0.20, regional: 0.30, peer: 0.50 },
  market_health: { national: 0.50, regional: 0.30, peer: 0.20 },
};

// Analysis modes
type AnalysisMode = 'raw' | 'national' | 'regional' | 'peer' | 'weighted';

// Market condition windows
const MARKET_WINDOWS = [
  { name: 'Pre-COVID', startDate: '2018-01-01', endDate: '2018-03-01' },
  { name: 'COVID Entry', startDate: '2020-01-01', endDate: '2020-03-01' },
  { name: 'Post-COVID Boom', startDate: '2021-01-01', endDate: '2021-03-01' },
  { name: 'Rate Hike', startDate: '2022-01-01', endDate: '2022-03-01' },
  { name: 'Recent', startDate: '2024-01-01', endDate: '2024-03-01' },
];

// Statistical functions
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const squaredDiffs = arr.map(val => Math.pow(val - m, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / (arr.length - 1));
}

// Pearson correlation coefficient
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);
  const stdX = stdDev(x);
  const stdY = stdDev(y);

  if (stdX === 0 || stdY === 0) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (x[i] - meanX) * (y[i] - meanY);
  }

  return sum / ((n - 1) * stdX * stdY);
}

// Spearman rank correlation
function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;

  // Convert to ranks
  const rankX = toRanks(x);
  const rankY = toRanks(y);

  return pearsonCorrelation(rankX, rankY);
}

function toRanks(arr: number[]): number[] {
  const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
  const ranks = new Array(arr.length);

  for (let i = 0; i < sorted.length; i++) {
    ranks[sorted[i].idx] = i + 1;
  }

  return ranks;
}

// Calculate R-squared
function rSquared(x: number[], y: number[]): number {
  const r = pearsonCorrelation(x, y);
  return r * r;
}

interface AnalysisResult {
  scoreType: ScoreType;
  horizon: number;
  analysisMode: AnalysisMode;
  sampleSize: number;
  pearsonR: number;
  spearmanR: number;
  rSquared: number;
  directionalAccuracy: number;
  quintileSpread: number;
  quintileAvgs: number[];
  topBeatsBenchmark: boolean;  // Top quintile has positive excess
  bottomTrailsBenchmark: boolean;  // Bottom quintile has negative excess
  confidenceGrade: string;
  confidenceScore: number;
}

// Fetch data for analysis - supports both raw and excess return modes
async function fetchBacktestData(
  scoreType: ScoreType,
  horizonMonths: number,
  windowStart: string,
  windowEnd: string,
  analysisMode: AnalysisMode = 'weighted',
  sampleSize = 50000
): Promise<{ scores: number[]; outcomes: number[] }> {
  const scoreCol = `${scoreType}_score`;
  const rawCol = `actual_appreciation_${horizonMonths}m`;

  // Determine which outcome column to use based on analysis mode
  let outcomeCol: string;
  switch (analysisMode) {
    case 'national':
      outcomeCol = `excess_return_vs_national_${horizonMonths}m`;
      break;
    case 'regional':
      outcomeCol = `excess_return_vs_regional_${horizonMonths}m`;
      break;
    case 'peer':
      outcomeCol = `excess_return_vs_peer_${horizonMonths}m`;
      break;
    case 'weighted':
      outcomeCol = `weighted_excess_return_${horizonMonths}m`;
      break;
    default:
      outcomeCol = rawCol;
  }

  // Build select columns
  const selectCols = [scoreCol, outcomeCol];

  // For weighted mode, if weighted column is null, we can calculate from components
  if (analysisMode === 'weighted') {
    selectCols.push(
      `excess_return_vs_national_${horizonMonths}m`,
      `excess_return_vs_regional_${horizonMonths}m`,
      `excess_return_vs_peer_${horizonMonths}m`
    );
  }

  const { data, error } = await supabase
    .from('propertyiq_scores_history')
    .select(selectCols.join(', '))
    .gte('period_date', windowStart)
    .lte('period_date', windowEnd)
    .not(scoreCol, 'is', null)
    .limit(sampleSize);

  if (error || !data) {
    console.error(`Error fetching data: ${error?.message}`);
    return { scores: [], outcomes: [] };
  }

  const scores: number[] = [];
  const outcomes: number[] = [];
  const weights = BENCHMARK_WEIGHTS[scoreType];

  for (const row of data) {
    const score = row[scoreCol];
    if (score == null) continue;

    let outcome: number | null = null;

    if (analysisMode === 'weighted') {
      // Use weighted column if available, otherwise calculate
      outcome = row[outcomeCol];
      if (outcome == null) {
        const natExcess = row[`excess_return_vs_national_${horizonMonths}m`];
        const regExcess = row[`excess_return_vs_regional_${horizonMonths}m`];
        const peerExcess = row[`excess_return_vs_peer_${horizonMonths}m`];

        // Calculate weighted excess with available components
        let totalWeight = 0;
        let weightedSum = 0;

        if (natExcess != null) {
          weightedSum += natExcess * weights.national;
          totalWeight += weights.national;
        }
        if (regExcess != null) {
          weightedSum += regExcess * weights.regional;
          totalWeight += weights.regional;
        }
        if (peerExcess != null) {
          weightedSum += peerExcess * weights.peer;
          totalWeight += weights.peer;
        }

        if (totalWeight > 0) {
          outcome = weightedSum / totalWeight;
        }
      }
    } else {
      outcome = row[outcomeCol];
    }

    if (outcome != null) {
      scores.push(score);
      outcomes.push(outcome);
    }
  }

  return { scores, outcomes };
}

// Quintile analysis
function quintileAnalysis(scores: number[], outcomes: number[]): { spread: number; avgs: number[] } {
  if (scores.length < 10) return { spread: 0, avgs: [] };

  // Pair and sort by score
  const pairs = scores.map((score, i) => ({ score, outcome: outcomes[i] }));
  pairs.sort((a, b) => a.score - b.score);

  // Split into quintiles
  const quintileSize = Math.floor(pairs.length / 5);
  const quintileAvgs: number[] = [];

  for (let q = 0; q < 5; q++) {
    const start = q * quintileSize;
    const end = q === 4 ? pairs.length : (q + 1) * quintileSize;
    const quintilePairs = pairs.slice(start, end);
    const avg = mean(quintilePairs.map(p => p.outcome));
    quintileAvgs.push(avg);
  }

  // Spread = Q5 avg - Q1 avg
  const spread = quintileAvgs[4] - quintileAvgs[0];

  return { spread, avgs: quintileAvgs };
}

// Directional accuracy for excess returns
// For excess returns: high score -> positive excess, low score -> negative excess
function directionalAccuracy(scores: number[], outcomes: number[], isExcessReturn = true): number {
  if (scores.length < 10) return 0;

  const medianScore = median(scores);

  let correct = 0;
  let total = 0;

  for (let i = 0; i < scores.length; i++) {
    const highScore = scores[i] >= medianScore;

    // For excess returns, the benchmark is 0 (positive = beat, negative = trailed)
    // For raw returns, compare to median
    const benchmark = isExcessReturn ? 0 : median(outcomes);
    const goodOutcome = outcomes[i] >= benchmark;

    // Score correctly predicted outcome direction
    if ((highScore && goodOutcome) || (!highScore && !goodOutcome)) {
      correct++;
    }
    total++;
  }

  return total > 0 ? correct / total : 0;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Calculate confidence grade
function calculateConfidenceGrade(
  rSq: number,
  dirAccuracy: number,
  quintileSpread: number,
  windowConsistency: number
): { grade: string; score: number } {
  // Normalize quintile spread (assume 0.10 is excellent for 1yr)
  const normalizedSpread = Math.min(Math.abs(quintileSpread) / 0.10, 1);

  // Weighted score
  const score =
    rSq * 0.30 +
    dirAccuracy * 0.30 +
    normalizedSpread * 0.25 +
    windowConsistency * 0.15;

  let grade: string;
  if (score >= 0.75) grade = 'A';
  else if (score >= 0.60) grade = 'B';
  else if (score >= 0.45) grade = 'C';
  else if (score >= 0.30) grade = 'D';
  else grade = 'F';

  return { grade, score };
}

// Run analysis for a score type and horizon with specific analysis mode
async function analyzeScoreHorizon(
  scoreType: ScoreType,
  horizon: number,
  analysisMode: AnalysisMode = 'weighted'
): Promise<AnalysisResult | null> {
  // Aggregate across all windows
  let allScores: number[] = [];
  let allOutcomes: number[] = [];
  const windowResults: number[] = [];
  const isExcessReturn = analysisMode !== 'raw';

  for (const window of MARKET_WINDOWS) {
    // Skip windows that don't have enough time for this horizon
    const windowDate = new Date(window.startDate);
    const horizonDate = new Date(windowDate);
    horizonDate.setMonth(horizonDate.getMonth() + horizon);

    // Need at least until 2025-11 for outcomes
    if (horizonDate > new Date('2025-11-30')) continue;

    const { scores, outcomes } = await fetchBacktestData(
      scoreType,
      horizon,
      window.startDate,
      window.endDate,
      analysisMode,
      10000
    );

    if (scores.length >= 100) {
      allScores = allScores.concat(scores);
      allOutcomes = allOutcomes.concat(outcomes);
      const windowDir = directionalAccuracy(scores, outcomes, isExcessReturn);
      windowResults.push(windowDir);
    }
  }

  if (allScores.length < 100) {
    return null;
  }

  const pearsonR = pearsonCorrelation(allScores, allOutcomes);
  const spearmanR = spearmanCorrelation(allScores, allOutcomes);
  const rSq = rSquared(allScores, allOutcomes);
  const dirAccuracy = directionalAccuracy(allScores, allOutcomes, isExcessReturn);
  const quintile = quintileAnalysis(allScores, allOutcomes);

  // For excess returns, check if top quintile beats benchmark and bottom trails
  const topBeatsBenchmark = quintile.avgs.length > 0 && quintile.avgs[4] > 0;
  const bottomTrailsBenchmark = quintile.avgs.length > 0 && quintile.avgs[0] < 0;

  // Window consistency = how similar are directional accuracy across windows
  const windowConsistency = windowResults.length > 1
    ? 1 - (stdDev(windowResults) / mean(windowResults))
    : 0.5;

  const { grade, score: confScore } = calculateConfidenceGrade(
    rSq,
    dirAccuracy,
    quintile.spread,
    windowConsistency
  );

  return {
    scoreType,
    horizon,
    analysisMode,
    sampleSize: allScores.length,
    pearsonR: Math.round(pearsonR * 1000) / 1000,
    spearmanR: Math.round(spearmanR * 1000) / 1000,
    rSquared: Math.round(rSq * 1000) / 1000,
    directionalAccuracy: Math.round(dirAccuracy * 1000) / 1000,
    quintileSpread: Math.round(quintile.spread * 10000) / 10000,
    quintileAvgs: quintile.avgs.map(a => Math.round(a * 10000) / 10000),
    topBeatsBenchmark,
    bottomTrailsBenchmark,
    confidenceGrade: grade,
    confidenceScore: Math.round(confScore * 100) / 100,
  };
}

// Format percentage
function pct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

// Main analysis
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  PROPERTYIQ BACKTEST ANALYSIS - Benchmark-Adjusted                           ║');
  console.log('║  Validating scores against EXCESS returns (benchmark-beating performance)    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  console.log('Benchmark weights by score type:');
  console.log('  HomeReady:    20% national, 50% regional, 30% peer (homebuyers compare regionally)');
  console.log('  InvestorEdge: 20% national, 30% regional, 50% peer (investors compare similar markets)');
  console.log('  Market Health: 50% national, 30% regional, 20% peer (relative to US conditions)\n');

  const results: AnalysisResult[] = [];

  // Check command line args for analysis mode
  const argMode = process.argv[2] as AnalysisMode | undefined;
  const analysisMode: AnalysisMode = argMode && ['raw', 'national', 'regional', 'peer', 'weighted'].includes(argMode)
    ? argMode
    : 'raw'; // Default to raw for now until excess returns are populated

  const modeLabel = analysisMode === 'raw' ? 'Raw Returns' : 'Weighted Excess Returns';

  // Run analysis for each score type and horizon
  for (const scoreType of SCORE_TYPES) {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  Analyzing ${scoreType.toUpperCase()} SCORE (${modeLabel})`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    for (const horizon of HORIZONS) {
      process.stdout.write(`  ${horizon}m horizon: `);
      const result = await analyzeScoreHorizon(scoreType, horizon, analysisMode);

      if (result) {
        results.push(result);
        const topMark = result.topBeatsBenchmark ? '[+]' : '[-]';
        const botMark = result.bottomTrailsBenchmark ? '[+]' : '[-]';
        console.log(`n=${result.sampleSize}, r=${result.pearsonR}, Dir=${pct(result.directionalAccuracy)}, Top${topMark} Bot${botMark} Grade=${result.confidenceGrade}`);
      } else {
        console.log('Insufficient data');
      }
    }
  }

  // Print comprehensive report
  console.log('\n\n');
  if (analysisMode === 'raw') {
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        BACKTEST RESULTS SUMMARY - Raw Returns Analysis                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        BACKTEST RESULTS SUMMARY - Benchmark-Adjusted Analysis                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  }

  for (const scoreType of SCORE_TYPES) {
    const scoreResults = results.filter(r => r.scoreType === scoreType);
    if (scoreResults.length === 0) continue;

    const label = scoreType === 'investoredge' ? 'INVESTOREDGE' :
                  scoreType === 'homeready' ? 'HOMEREADY' : 'MARKET HEALTH';
    const prediction = analysisMode === 'raw'
      ? 'predict higher appreciation?'
      : 'beat their benchmarks?';

    console.log(`${label} SCORE - Did high scores ${prediction}`);
    console.log('─'.repeat(88));
    if (analysisMode === 'raw') {
      console.log('Horizon  | Sample   | Top 20%    | Bot 20%    | Spread  | Monotonic | Dir Acc  | Grade');
      console.log('         |          | (Return)   | (Return)   |         |           |          |');
    } else {
      console.log('Horizon  | Sample   | Top 20%    | Bot 20%    | Spread  | Top Beat? | Bot Trail? | Grade');
      console.log('         |          | (Excess)   | (Excess)   |         |           |            |');
    }
    console.log('─'.repeat(88));

    for (const r of scoreResults) {
      const topAvg = r.quintileAvgs[4] ?? 0;
      const botAvg = r.quintileAvgs[0] ?? 0;

      // Format returns with +/- sign
      const topStr = topAvg >= 0 ? `+${pct(topAvg)}` : pct(topAvg);
      const botStr = botAvg >= 0 ? `+${pct(botAvg)}` : pct(botAvg);
      const spreadStr = r.quintileSpread >= 0 ? `+${pct(r.quintileSpread)}` : pct(r.quintileSpread);

      if (analysisMode === 'raw') {
        // For raw mode, check if quintiles are monotonically increasing
        const isMonotonic = r.quintileAvgs.length === 5 &&
          r.quintileAvgs[0] < r.quintileAvgs[2] && r.quintileAvgs[2] < r.quintileAvgs[4];
        const monoCheck = isMonotonic ? 'YES' : 'no';
        console.log(
          `${String(r.horizon).padStart(3)}m     | ` +
          `${String(r.sampleSize).padStart(7)}  | ` +
          `${topStr.padStart(8)}   | ` +
          `${botStr.padStart(8)}   | ` +
          `${spreadStr.padStart(6)} | ` +
          `${monoCheck.padStart(9)} | ` +
          `${pct(r.directionalAccuracy).padStart(7)} | ` +
          `  ${r.confidenceGrade}`
        );
      } else {
        const topCheck = r.topBeatsBenchmark ? 'YES' : 'no';
        const botCheck = r.bottomTrailsBenchmark ? 'YES' : 'no';
        console.log(
          `${String(r.horizon).padStart(3)}m     | ` +
          `${String(r.sampleSize).padStart(7)}  | ` +
          `${topStr.padStart(8)}   | ` +
          `${botStr.padStart(8)}   | ` +
          `${spreadStr.padStart(6)} | ` +
          `${topCheck.padStart(9)} | ` +
          `${botCheck.padStart(10)} | ` +
          `  ${r.confidenceGrade}`
        );
      }
    }

    console.log('─'.repeat(88));

    // Interpretation
    const avgSpread = mean(scoreResults.map(r => r.quintileSpread));
    const bestGrade = scoreResults.reduce((best, r) =>
      r.confidenceScore > best.confidenceScore ? r : best, scoreResults[0]);

    if (analysisMode === 'raw') {
      // For raw returns, check if quintiles show monotonic increase
      const validatedHorizons = scoreResults.filter(r => {
        const avgs = r.quintileAvgs;
        return avgs.length === 5 && avgs[0] < avgs[2] && avgs[2] < avgs[4] && r.quintileSpread > 0;
      });

      if (validatedHorizons.length === scoreResults.length) {
        console.log(`[OK] VALIDATED: High ${label} scores → higher appreciation (all horizons)`);
        console.log(`     Avg quintile spread: +${pct(avgSpread)}`);
      } else if (validatedHorizons.length > 0) {
        console.log(`[~] PARTIAL: ${validatedHorizons.length}/${scoreResults.length} horizons show monotonic quintile pattern`);
        console.log(`     Validated: ${validatedHorizons.map(r => `${r.horizon}m`).join(', ')}`);
      } else if (avgSpread > 0) {
        console.log(`[!] WEAK: Positive spread but not monotonic across quintiles`);
      } else {
        console.log(`[X] NOT VALIDATED: Scores did not predict higher appreciation`);
      }
    } else {
      // For excess returns, check benchmark-beating
      const validatedHorizons = scoreResults.filter(r => r.topBeatsBenchmark && r.bottomTrailsBenchmark);

      if (validatedHorizons.length === scoreResults.length) {
        console.log(`[OK] FULLY VALIDATED: High ${label} scores beat benchmarks, low scores trailed`);
        console.log(`     Top quintile excess: +${pct(mean(scoreResults.map(r => r.quintileAvgs[4] ?? 0)))} | Bottom quintile excess: ${pct(mean(scoreResults.map(r => r.quintileAvgs[0] ?? 0)))}`);
      } else if (validatedHorizons.length > 0) {
        console.log(`[~] PARTIALLY VALIDATED: ${validatedHorizons.length}/${scoreResults.length} horizons show benchmark-beating pattern`);
        console.log(`     Validated horizons: ${validatedHorizons.map(r => `${r.horizon}m`).join(', ')}`);
      } else if (avgSpread > 0) {
        console.log(`[!] WEAK: Positive spread but top/bottom quintiles don't clearly beat/trail benchmark`);
      } else {
        console.log(`[X] NOT VALIDATED: Scores did not predict benchmark-beating performance`);
      }
    }

    console.log(`  Best confidence: ${bestGrade.horizon}m horizon (Grade ${bestGrade.confidenceGrade}, score=${bestGrade.confidenceScore})`);
    console.log('\n');
  }

  // Overall summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  CONFIDENCE GRADES SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log('  Grade | Interpretation                    | Scores with this grade');
  console.log('  ──────┼─────────────────────────────────┼────────────────────────');

  const grades = ['A', 'B', 'C', 'D', 'F'];
  const gradeDescriptions: Record<string, string> = {
    A: 'Strong predictive power           ',
    B: 'Good predictive power             ',
    C: 'Moderate predictive power         ',
    D: 'Weak predictive power             ',
    F: 'Poor predictive power             ',
  };

  for (const grade of grades) {
    const gradeResults = results.filter(r => r.confidenceGrade === grade);
    const scoreList = gradeResults.map(r => `${r.scoreType}/${r.horizon}m`).join(', ') || '-';
    console.log(`    ${grade}   | ${gradeDescriptions[grade]} | ${scoreList}`);
  }

  console.log('\n');

  // Recommendations
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const goodScores = results.filter(r => ['A', 'B'].includes(r.confidenceGrade));
  const weakScores = results.filter(r => ['D', 'F'].includes(r.confidenceGrade));

  if (goodScores.length > 0) {
    console.log('  Scores with strong validation (use with confidence):');
    for (const r of goodScores) {
      console.log(`    - ${r.scoreType}/${r.horizon}m: Grade ${r.confidenceGrade}, spread=${pct(r.quintileSpread)}`);
    }
  }

  if (weakScores.length > 0) {
    console.log('\n  Scores needing improvement:');
    for (const r of weakScores) {
      console.log(`    - ${r.scoreType}/${r.horizon}m: Grade ${r.confidenceGrade} - consider refining calculation`);
    }
  }

  console.log('\n✓ Backtest analysis complete');
}

main().catch(console.error);
