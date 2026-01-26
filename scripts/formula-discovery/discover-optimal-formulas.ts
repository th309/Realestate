/**
 * Formula Discovery System
 * 
 * Analyzes RAW data (not scores) to discover optimal formulas for PropertyIQ scores.
 * 
 * This script:
 * 1. Pulls raw metrics from all data sources (Zillow, Realtor, Census, Economic)
 * 2. Calculates forward outcomes (1y, 3y, 5y, 10y appreciation)
 * 3. Runs correlation analysis between each metric and outcomes
 * 4. Runs regression to find optimal weights
 * 5. Validates results with quintile analysis
 * 6. Outputs summary tables and recommendations
 * 
 * Usage:
 *   npx ts-node scripts/formula-discovery/discover-optimal-formulas.ts [options]
 * 
 * Options:
 *   --outcome=price|rent|total    Target outcome (default: price)
 *   --horizon=1|3|5|10            Time horizon in years (default: 3)
 *   --geo=metro|county|zip        Geography level (default: metro)
 *   --all                         Run all combinations
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Score types we're trying to optimize
type ScoreType = 'homeready' | 'investoredge' | 'markethealth';
type GeoLevel = 'metro' | 'county' | 'zip';
type OutcomeType = 'price' | 'rent' | 'total';
type HorizonYears = 1 | 3 | 5 | 10;

// Raw metrics we can pull from each source
// Note: Different sources use different ID columns and date columns per geography level
interface SourceConfig {
  table: string;
  metrics: string[];
  geoColumns: Record<GeoLevel, string>;
  isLongFormat: boolean;
  dateColumn: string;
  dateType: 'date' | 'year';
}

// Use cbsa_code as the common ID for metros (Zillow has it, Realtor/Census/Economic use it)
// For county, use fips_code. For zip, use the zip code (region_id).
const RAW_METRICS: Record<string, SourceConfig> = {
  zillow: {
    table: 'zillow_{geo}',
    geoColumns: { metro: 'cbsa_code', county: 'fips_code', zip: 'region_id' }, // County uses fips_code!
    isLongFormat: true, // Uses metric_name column
    dateColumn: 'period_date',
    dateType: 'date',
    metrics: [
      'zhvi', 'zhvi_yoy', 'zori', 'zori_yoy', 'inventory', 'inventory_yoy',
      'dom', 'sale_price', 'list_price', 'new_listings', 'pending_sales',
      'sale_to_list', 'price_cuts'
    ]
  },
  realtor: {
    table: 'realtor_{geo}',
    geoColumns: { metro: 'cbsa_code', county: 'county_fips', zip: 'postal_code' },
    isLongFormat: false, // Wide format with columns
    dateColumn: 'period_date',
    dateType: 'date',
    metrics: [
      'median_listing_price', 'median_listing_price_yy', 'active_listing_count',
      'active_listing_count_yy', 'median_days_on_market', 'new_listing_count',
      'new_listing_count_yy', 'pending_listing_count', 'pending_listing_count_yy',
      'price_reduced_share', 'hotness_score', 'supply_score', 'demand_score',
      'pending_ratio'
    ]
  },
  census: {
    table: 'census_{geo}',
    geoColumns: { metro: 'cbsa_code', county: 'fips_code', zip: 'zcta' },
    isLongFormat: false,
    dateColumn: 'year',
    dateType: 'year',
    metrics: [
      'total_population', 'population_yoy', 'median_household_income', 'income_yoy',
      'total_housing_units', 'owner_occupied_units', 'renter_occupied_units',
      'homeownership_rate', 'median_home_value', 'median_gross_rent'
    ]
  },
  economic: {
    table: 'economic_{geo}',
    geoColumns: { metro: 'cbsa_code', county: 'fips_code', zip: 'zip_code' },
    isLongFormat: false,
    dateColumn: 'period_date',
    dateType: 'date',
    metrics: [
      'unemployment_rate', 'unemployment_rate_yoy', 'total_nonfarm_employment',
      'employment_yoy', 'gdp_millions', 'gdp_yoy'
    ]
  }
};

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

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

function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;
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

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// T-test for correlation significance
function correlationPValue(r: number, n: number): number {
  if (n < 4 || r === 1 || r === -1) return 1;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Approximate p-value using Student's t distribution
  const df = n - 2;
  const x = df / (df + t * t);
  // Simple approximation for p-value
  if (Math.abs(t) > 3.5) return 0.001;
  if (Math.abs(t) > 2.5) return 0.01;
  if (Math.abs(t) > 2.0) return 0.05;
  if (Math.abs(t) > 1.7) return 0.10;
  return 0.5;
}

// Ridge regression for optimal weights
function ridgeRegression(X: number[][], y: number[], lambda = 0.1): number[] {
  const n = X.length;
  const p = X[0]?.length || 0;
  if (n === 0 || p === 0) return [];

  // Standardize X
  const xMeans: number[] = [];
  const xStds: number[] = [];
  for (let j = 0; j < p; j++) {
    const col = X.map(row => row[j]);
    xMeans.push(mean(col));
    xStds.push(stdDev(col) || 1);
  }

  const Xs = X.map(row => row.map((val, j) => (val - xMeans[j]) / xStds[j]));
  const yMean = mean(y);
  const ys = y.map(val => val - yMean);

  // X'X + lambda*I
  const XtX: number[][] = [];
  for (let i = 0; i < p; i++) {
    XtX[i] = [];
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += Xs[k][i] * Xs[k][j];
      }
      XtX[i][j] = sum + (i === j ? lambda * n : 0);
    }
  }

  // X'y
  const Xty: number[] = [];
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += Xs[k][i] * ys[k];
    }
    Xty.push(sum);
  }

  // Solve using Gaussian elimination (simplified)
  const coeffs = solveLinearSystem(XtX, Xty);
  
  // Unstandardize
  return coeffs.map((c, j) => c / xStds[j]);
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

interface DataPoint {
  regionId: string;
  date: string;
  metrics: Record<string, number | null>;
  outcome: number | null;
}

async function fetchRawMetricsAndOutcomes(
  geoLevel: GeoLevel,
  outcomeType: OutcomeType,
  horizonYears: HorizonYears,
  snapshotDate: string
): Promise<DataPoint[]> {
  console.log(`\n  Fetching ${geoLevel} data for ${snapshotDate}...`);

  // Calculate outcome date
  const snapshot = new Date(snapshotDate);
  const outcomeDate = new Date(snapshot);
  outcomeDate.setFullYear(outcomeDate.getFullYear() + horizonYears);
  const outcomeDateStr = outcomeDate.toISOString().split('T')[0];

  // Fetch ZHVI at snapshot and outcome dates
  const zhviTable = `zillow_${geoLevel}`;
  
  // Use the common ID column per geography:
  // - Metro: cbsa_code (5-digit CBSA)
  // - County: fips_code (5-digit FIPS)
  // - ZIP: region_id (Zillow's internal ID)
  const zillowIdCol = geoLevel === 'metro' ? 'cbsa_code' : 
                      geoLevel === 'county' ? 'fips_code' : 'region_id';
  
  // Get base ZHVI values at snapshot
  const { data: baseData, error: baseError } = await supabase
    .from(zhviTable)
    .select(`${zillowIdCol}, value`)
    .eq('metric_name', 'zhvi')
    .gte('period_date', snapshotDate)
    .lt('period_date', new Date(new Date(snapshotDate).setMonth(new Date(snapshotDate).getMonth() + 1)).toISOString().split('T')[0])
    .not(zillowIdCol, 'is', null);
    // No limit - fetch ALL regions

  if (baseError) {
    console.error(`Error fetching base ZHVI: ${baseError.message}`);
    return [];
  }

  // Get outcome ZHVI values
  const { data: outcomeData, error: outcomeError } = await supabase
    .from(zhviTable)
    .select(`${zillowIdCol}, value`)
    .eq('metric_name', 'zhvi')
    .gte('period_date', outcomeDateStr)
    .lt('period_date', new Date(new Date(outcomeDateStr).setMonth(new Date(outcomeDateStr).getMonth() + 1)).toISOString().split('T')[0])
    .not(zillowIdCol, 'is', null);
    // No limit - fetch ALL regions

  if (outcomeError) {
    console.error(`Error fetching outcome ZHVI: ${outcomeError.message}`);
    return [];
  }

  // Map outcome values by region
  const outcomeMap = new Map<string, number>();
  for (const row of outcomeData || []) {
    const id = String((row as any)[zillowIdCol]);
    outcomeMap.set(id, (row as any).value);
  }

  // Calculate outcomes and build result
  const results: DataPoint[] = [];
  for (const row of baseData || []) {
    const regionId = String((row as any)[zillowIdCol]);
    const baseValue = (row as any).value;
    const futureValue = outcomeMap.get(regionId);
    
    if (baseValue && futureValue && baseValue > 0) {
      // Calculate appreciation
      const appreciation = (futureValue - baseValue) / baseValue;
      
      results.push({
        regionId: regionId, // Use the common ID (cbsa_code for metros)
        date: snapshotDate,
        metrics: {},
        outcome: appreciation
      });
    }
  }

  console.log(`    Found ${results.length} regions with outcome data`);

  // Now fetch all raw metrics for these regions
  const regionIds = results.map(r => r.regionId);
  
  for (const [source, config] of Object.entries(RAW_METRICS)) {
    const tableName = config.table.replace('{geo}', geoLevel);
    const geoColumn = config.geoColumns[geoLevel];
    
    try {
      if (config.isLongFormat) {
        // Zillow uses long format with metric_name column
        const { data: metricData, error: metricError } = await supabase
          .from(tableName)
          .select(`${geoColumn}, metric_name, value`)
          .in(geoColumn, regionIds)
          .gte('period_date', snapshotDate)
          .lt('period_date', new Date(new Date(snapshotDate).setMonth(new Date(snapshotDate).getMonth() + 2)).toISOString().split('T')[0]);
          // No limit - fetch ALL metrics

        if (metricError) {
          console.log(`    Skipping ${source}: ${metricError.message}`);
          continue;
        }

        // Group metrics by region (use string IDs)
        const regionMetrics = new Map<string, Record<string, number>>();
        for (const row of metricData || []) {
          const regionId = String((row as any)[geoColumn]);
          if (!regionMetrics.has(regionId)) {
            regionMetrics.set(regionId, {});
          }
          const metrics = regionMetrics.get(regionId)!;
          metrics[`${source}_${(row as any).metric_name}`] = (row as any).value;
        }

        // Add to results
        for (const result of results) {
          const metrics = regionMetrics.get(result.regionId);
          if (metrics) {
            Object.assign(result.metrics, metrics);
          }
        }

        console.log(`    Added ${metricData?.length || 0} metric values from ${source}`);
      } else {
        // Wide format tables (realtor, census, economic)
        // Build select columns
        const selectCols = [geoColumn, ...config.metrics].join(', ');
        
        // Build query with appropriate date filtering
        let query = supabase.from(tableName).select(selectCols).in(geoColumn, regionIds);
        
        // Apply date filter based on source type
        if (config.dateType === 'year') {
          // Census uses year column (integer)
          const year = parseInt(snapshotDate.slice(0, 4));
          query = query.eq(config.dateColumn, year);
        } else {
          // Realtor and Economic use period_date (date)
          // Get data within 2 months of snapshot
          const endDate = new Date(snapshotDate);
          endDate.setMonth(endDate.getMonth() + 2);
          query = query
            .gte(config.dateColumn, snapshotDate)
            .lt(config.dateColumn, endDate.toISOString().split('T')[0]);
        }
        
        const { data: wideData, error: wideError } = await query;
        // No limit - fetch ALL data

        if (wideError) {
          console.log(`    Skipping ${source}: ${wideError.message}`);
          continue;
        }

        // Add metrics to results - use string comparison for IDs
        let addedCount = 0;
        for (const row of wideData || []) {
          const rowId = String((row as any)[geoColumn]);
          const result = results.find(r => r.regionId === rowId);
          if (result) {
            for (const metric of config.metrics) {
              const value = (row as any)[metric];
              if (value != null && !isNaN(Number(value))) {
                result.metrics[`${source}_${metric}`] = Number(value);
                addedCount++;
              }
            }
          }
        }

        console.log(`    Added ${addedCount} metric values from ${source} (${wideData?.length || 0} rows)`);
      }
    } catch (err: any) {
      console.log(`    Error with ${source}: ${err.message}`);
    }
  }

  return results;
}

// ============================================================================
// ANALYSIS
// ============================================================================

interface MetricCorrelation {
  metric: string;
  correlation: number;
  pValue: number;
  sampleSize: number;
  direction: 1 | -1;
}

interface QuintileResult {
  quintile: number;
  avgOutcome: number;
  count: number;
  beatRate: number;
}

interface FormulaResult {
  scoreType: ScoreType;
  geoLevel: GeoLevel;
  horizon: HorizonYears;
  outcome: OutcomeType;
  sampleSize: number;
  topMetrics: MetricCorrelation[];
  optimizedWeights: Record<string, { weight: number; direction: 1 | -1 }>;
  validation: {
    spread: number;
    topQuintileExcess: number;
    bottomQuintileExcess: number;
    topBeatRate: number;
    bottomBeatRate: number;
    spearmanR: number;
    pValue: string;
    quintiles: QuintileResult[];
  };
}

function analyzeMetricCorrelations(data: DataPoint[]): MetricCorrelation[] {
  // Get all metric names
  const metricNames = new Set<string>();
  for (const d of data) {
    for (const key of Object.keys(d.metrics)) {
      metricNames.add(key);
    }
  }

  const correlations: MetricCorrelation[] = [];

  for (const metric of metricNames) {
    // Extract paired values
    const pairs: { x: number; y: number }[] = [];
    for (const d of data) {
      const x = d.metrics[metric];
      const y = d.outcome;
      if (x != null && y != null && !isNaN(x) && !isNaN(y)) {
        pairs.push({ x, y });
      }
    }

    if (pairs.length < 30) continue;

    const x = pairs.map(p => p.x);
    const y = pairs.map(p => p.y);
    const r = spearmanCorrelation(x, y);
    const pValue = correlationPValue(r, pairs.length);

    correlations.push({
      metric,
      correlation: r,
      pValue,
      sampleSize: pairs.length,
      direction: r >= 0 ? 1 : -1
    });
  }

  // Sort by absolute correlation
  correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return correlations;
}

function runQuintileAnalysis(
  data: DataPoint[],
  weights: Record<string, { weight: number; direction: 1 | -1 }>
): QuintileResult[] {
  // Calculate composite scores
  const scored = data
    .map(d => {
      let score = 0;
      let totalWeight = 0;

      for (const [metric, config] of Object.entries(weights)) {
        const value = d.metrics[metric];
        if (value != null && !isNaN(value)) {
          score += config.direction * config.weight * value;
          totalWeight += config.weight;
        }
      }

      return {
        regionId: d.regionId,
        score: totalWeight > 0 ? score / totalWeight : null,
        outcome: d.outcome
      };
    })
    .filter(d => d.score != null && d.outcome != null) as { regionId: string; score: number; outcome: number }[];

  if (scored.length < 50) return [];

  // Sort by score
  scored.sort((a, b) => a.score - b.score);

  // Calculate median outcome
  const medianOutcome = median(scored.map(s => s.outcome));

  // Split into quintiles
  const quintileSize = Math.floor(scored.length / 5);
  const quintiles: QuintileResult[] = [];

  for (let q = 0; q < 5; q++) {
    const start = q * quintileSize;
    const end = q === 4 ? scored.length : (q + 1) * quintileSize;
    const slice = scored.slice(start, end);
    
    const avgOutcome = mean(slice.map(s => s.outcome));
    const beatRate = slice.filter(s => s.outcome > medianOutcome).length / slice.length;

    quintiles.push({
      quintile: q + 1,
      avgOutcome,
      count: slice.length,
      beatRate
    });
  }

  return quintiles;
}

function optimizeFormula(
  data: DataPoint[],
  topMetrics: MetricCorrelation[],
  maxFeatures = 8
): Record<string, { weight: number; direction: 1 | -1 }> {
  // Take top correlated metrics
  const selectedMetrics = topMetrics
    .filter(m => Math.abs(m.correlation) > 0.05 && m.pValue < 0.1)
    .slice(0, maxFeatures);

  if (selectedMetrics.length === 0) {
    console.log('    No significant metrics found');
    return {};
  }

  // Build feature matrix
  const validData = data.filter(d => {
    if (d.outcome == null) return false;
    for (const m of selectedMetrics) {
      if (d.metrics[m.metric] == null) return false;
    }
    return true;
  });

  if (validData.length < 50) {
    console.log(`    Insufficient data: ${validData.length} rows`);
    return {};
  }

  const X = validData.map(d => 
    selectedMetrics.map(m => {
      const val = d.metrics[m.metric] || 0;
      // Z-score normalize
      return val;
    })
  );
  const y = validData.map(d => d.outcome!);

  // Run ridge regression
  const coefficients = ridgeRegression(X, y, 0.1);

  // Convert to weights
  const weights: Record<string, { weight: number; direction: 1 | -1 }> = {};
  let totalWeight = 0;

  for (let i = 0; i < selectedMetrics.length; i++) {
    const coef = coefficients[i] || 0;
    totalWeight += Math.abs(coef);
  }

  for (let i = 0; i < selectedMetrics.length; i++) {
    const metric = selectedMetrics[i];
    const coef = coefficients[i] || 0;
    
    weights[metric.metric] = {
      weight: totalWeight > 0 ? Math.abs(coef) / totalWeight : 0,
      direction: coef >= 0 ? 1 : -1
    };
  }

  return weights;
}

async function discoverFormula(
  geoLevel: GeoLevel,
  outcomeType: OutcomeType,
  horizonYears: HorizonYears
): Promise<FormulaResult | null> {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ANALYZING: ${geoLevel.toUpperCase()} | ${outcomeType.toUpperCase()} | ${horizonYears}-YEAR HORIZON`);
  console.log(`${'═'.repeat(70)}`);

  // Fetch data from multiple time periods
  const snapshotDates = [
    '2015-01-01', '2016-01-01', '2017-01-01', '2018-01-01', 
    '2019-01-01', '2020-01-01', '2021-01-01'
  ];

  // Filter dates based on horizon (need outcome data)
  const maxYear = 2025 - horizonYears;
  const validDates = snapshotDates.filter(d => parseInt(d.split('-')[0]) <= maxYear);

  let allData: DataPoint[] = [];
  for (const date of validDates) {
    const data = await fetchRawMetricsAndOutcomes(geoLevel, outcomeType, horizonYears, date);
    allData = allData.concat(data);
  }

  console.log(`\n  Total data points: ${allData.length}`);

  if (allData.length < 100) {
    console.log('  Insufficient data for analysis');
    return null;
  }

  // Analyze correlations
  console.log('\n  Analyzing metric correlations...');
  const correlations = analyzeMetricCorrelations(allData);

  console.log(`\n  TOP 15 CORRELATED METRICS:`);
  console.log(`  ${'─'.repeat(66)}`);
  console.log(`  ${'Metric'.padEnd(40)} | Corr    | p-value | n`);
  console.log(`  ${'─'.repeat(66)}`);
  
  for (const c of correlations.slice(0, 15)) {
    const pStr = c.pValue < 0.001 ? '<0.001' : c.pValue.toFixed(3);
    console.log(
      `  ${c.metric.padEnd(40)} | ${(c.correlation >= 0 ? '+' : '') + c.correlation.toFixed(3).padStart(6)} | ${pStr.padStart(6)} | ${c.sampleSize}`
    );
  }

  // Optimize formula
  console.log('\n  Running ridge regression for optimal weights...');
  const weights = optimizeFormula(allData, correlations);

  if (Object.keys(weights).length === 0) {
    return null;
  }

  // Validate with quintile analysis
  console.log('\n  Running quintile validation...');
  const quintiles = runQuintileAnalysis(allData, weights);

  if (quintiles.length < 5) {
    console.log('  Insufficient data for quintile analysis');
    return null;
  }

  // Calculate validation metrics
  const topQ = quintiles[4];
  const bottomQ = quintiles[0];
  const medianOutcome = median(allData.filter(d => d.outcome != null).map(d => d.outcome!));
  
  const spread = topQ.avgOutcome - bottomQ.avgOutcome;
  const topExcess = topQ.avgOutcome - medianOutcome;
  const bottomExcess = bottomQ.avgOutcome - medianOutcome;

  // Calculate overall correlation with optimized score
  const scores = allData
    .map(d => {
      let score = 0;
      let totalWeight = 0;
      for (const [metric, config] of Object.entries(weights)) {
        const value = d.metrics[metric];
        if (value != null) {
          score += config.direction * config.weight * value;
          totalWeight += config.weight;
        }
      }
      return { score: totalWeight > 0 ? score / totalWeight : null, outcome: d.outcome };
    })
    .filter(d => d.score != null && d.outcome != null) as { score: number; outcome: number }[];

  const spearmanR = spearmanCorrelation(
    scores.map(s => s.score),
    scores.map(s => s.outcome)
  );
  const pValue = correlationPValue(spearmanR, scores.length);

  // Determine score type based on outcome
  const scoreType: ScoreType = 
    outcomeType === 'rent' ? 'investoredge' :
    outcomeType === 'total' ? 'investoredge' : 'homeready';

  return {
    scoreType,
    geoLevel,
    horizon: horizonYears,
    outcome: outcomeType,
    sampleSize: allData.length,
    topMetrics: correlations.slice(0, 10),
    optimizedWeights: weights,
    validation: {
      spread,
      topQuintileExcess: topExcess,
      bottomQuintileExcess: bottomExcess,
      topBeatRate: topQ.beatRate,
      bottomBeatRate: bottomQ.beatRate,
      spearmanR,
      pValue: pValue < 0.001 ? '<0.001' : pValue.toFixed(3),
      quintiles
    }
  };
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function formatPct(val: number): string {
  const pct = val * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function printSummaryTable(results: FormulaResult[]): void {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                            FORMULA DISCOVERY RESULTS                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════╝');

  // Group by geography level
  const byGeo = new Map<GeoLevel, FormulaResult[]>();
  for (const r of results) {
    if (!byGeo.has(r.geoLevel)) byGeo.set(r.geoLevel, []);
    byGeo.get(r.geoLevel)!.push(r);
  }

  for (const [geo, geoResults] of byGeo) {
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  ${geo.toUpperCase()} LEVEL`);
    console.log(`${'═'.repeat(90)}\n`);

    console.log('  Summary Table');
    console.log('  ─────────────────────────────────────────────────────────────────────────────────────────');
    console.log('  Metric                          │ HomeReady    │ InvestorEdge │ MarketHealth │ Meaning');
    console.log('  ─────────────────────────────────────────────────────────────────────────────────────────');

    // Find results for each score type (use horizon as proxy)
    const homeready = geoResults.find(r => r.outcome === 'price');
    const investoredge = geoResults.find(r => r.outcome === 'total' || r.outcome === 'rent');
    const markethealth = geoResults.find(r => r.horizon === 1);

    const rows = [
      {
        label: 'Top Quintile Excess Return',
        hr: homeready?.validation.topQuintileExcess,
        ie: investoredge?.validation.topQuintileExcess,
        mh: markethealth?.validation.topQuintileExcess,
        meaning: 'Higher = better buy signal'
      },
      {
        label: 'Bottom Quintile Excess Return',
        hr: homeready?.validation.bottomQuintileExcess,
        ie: investoredge?.validation.bottomQuintileExcess,
        mh: markethealth?.validation.bottomQuintileExcess,
        meaning: 'Lower = better avoid signal'
      },
      {
        label: 'SPREAD',
        hr: homeready?.validation.spread,
        ie: investoredge?.validation.spread,
        mh: markethealth?.validation.spread,
        meaning: 'Bigger = more valuable'
      },
      {
        label: 'Top Q Beat-Market Rate',
        hr: homeready?.validation.topBeatRate,
        ie: investoredge?.validation.topBeatRate,
        mh: markethealth?.validation.topBeatRate,
        meaning: 'Higher = more reliable'
      },
      {
        label: 'Bottom Q Beat-Market Rate',
        hr: homeready?.validation.bottomBeatRate,
        ie: investoredge?.validation.bottomBeatRate,
        mh: markethealth?.validation.bottomBeatRate,
        meaning: 'Lower = stronger avoid'
      },
      {
        label: 'Spearman Correlation',
        hr: homeready?.validation.spearmanR,
        ie: investoredge?.validation.spearmanR,
        mh: markethealth?.validation.spearmanR,
        meaning: '>0.3 = meaningful'
      },
      {
        label: 'p-value',
        hr: homeready?.validation.pValue,
        ie: investoredge?.validation.pValue,
        mh: markethealth?.validation.pValue,
        meaning: '<0.05 = significant'
      }
    ];

    for (const row of rows) {
      const hrVal = typeof row.hr === 'number' ? formatPct(row.hr) : (row.hr || '--');
      const ieVal = typeof row.ie === 'number' ? formatPct(row.ie) : (row.ie || '--');
      const mhVal = typeof row.mh === 'number' ? formatPct(row.mh) : (row.mh || '--');

      console.log(
        `  ${row.label.padEnd(32)} │ ${hrVal.padStart(12)} │ ${ieVal.padStart(12)} │ ${mhVal.padStart(12)} │ ${row.meaning}`
      );
    }

    console.log('  ─────────────────────────────────────────────────────────────────────────────────────────\n');

    // Print recommended weights for each
    for (const result of geoResults) {
      console.log(`\n  OPTIMIZED FORMULA: ${result.scoreType.toUpperCase()} (${result.horizon}y ${result.outcome})`);
      console.log(`  ${'─'.repeat(50)}`);
      
      const sortedWeights = Object.entries(result.optimizedWeights)
        .sort(([, a], [, b]) => b.weight - a.weight);

      for (const [metric, config] of sortedWeights) {
        const dir = config.direction === 1 ? '+' : '-';
        console.log(`    ${dir} ${(config.weight * 100).toFixed(1).padStart(5)}%  ${metric}`);
      }
    }
  }

  // Recommendation section
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                               RECOMMENDATIONS                                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════╝\n');

  // Check if different geos need different formulas
  const spreads = new Map<GeoLevel, number>();
  for (const r of results) {
    if (!spreads.has(r.geoLevel)) {
      spreads.set(r.geoLevel, r.validation.spread);
    }
  }

  const spreadValues = Array.from(spreads.values());
  const spreadVariance = stdDev(spreadValues);

  if (spreadVariance > 0.02) {
    console.log('  RECOMMENDATION: Use DIFFERENT formulas per geography level (9 formulas)');
    console.log('  Reason: Significant variance in predictive power across geographies');
  } else {
    console.log('  RECOMMENDATION: Use SAME formulas across geography levels (3 formulas)');
    console.log('  Reason: Similar predictive power across geographies');
  }

  console.log('\n  Geography-level analysis:');
  for (const [geo, spread] of spreads) {
    const quality = spread > 0.05 ? 'STRONG' : spread > 0.02 ? 'MODERATE' : 'WEAK';
    console.log(`    ${geo.toUpperCase()}: ${formatPct(spread)} spread (${quality})`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PROPERTYIQ FORMULA DISCOVERY SYSTEM                                    ║');
  console.log('║                    Analyzing RAW data to find optimal formulas                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════╝\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const getArg = (name: string, defaultVal: string) => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : defaultVal;
  };

  const runAll = args.includes('--all');
  const outcome = getArg('outcome', 'price') as OutcomeType;
  const horizon = parseInt(getArg('horizon', '3')) as HorizonYears;
  const geo = getArg('geo', 'metro') as GeoLevel;

  console.log('Configuration:');
  console.log(`  Outcome: ${runAll ? 'all' : outcome}`);
  console.log(`  Horizon: ${runAll ? 'all' : horizon} years`);
  console.log(`  Geography: ${runAll ? 'all' : geo}`);

  const results: FormulaResult[] = [];

  if (runAll) {
    // Run all combinations
    const geos: GeoLevel[] = ['metro', 'county', 'zip'];
    const outcomes: OutcomeType[] = ['price'];
    const horizons: HorizonYears[] = [1, 3, 5];

    for (const g of geos) {
      for (const o of outcomes) {
        for (const h of horizons) {
          const result = await discoverFormula(g, o, h);
          if (result) results.push(result);
        }
      }
    }
  } else {
    const result = await discoverFormula(geo, outcome, horizon);
    if (result) results.push(result);
  }

  // Print summary
  if (results.length > 0) {
    printSummaryTable(results);
  } else {
    console.log('\nNo valid results generated.');
  }

  console.log('\n✓ Formula discovery complete');
}

main().catch(console.error);
