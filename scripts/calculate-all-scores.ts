/**
 * Calculate and store all PropertyIQ scores for all geographies
 * Uses the new spec methodology: z-score → weighted formula → 0-100 normalization
 *
 * - Saves to propertyiq_scores_v2 (normalized schema)
 * - Handles large datasets with pagination
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'packages/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Formula Weights from SCORING_SYSTEM_SPEC.md
// ============================================================================

type ScoreType = 'homeready' | 'investoredge' | 'markethealth';
type GeoLevel = 'metro' | 'county' | 'zip';

interface MetricWeight {
  weight: number;
  direction: 1 | -1;
}

const FORMULA_WEIGHTS: Record<GeoLevel, Record<ScoreType, Record<string, MetricWeight>>> = {
  metro: {
    homeready: {
      hotness_score: { weight: 0.706, direction: 1 },
      pending_ratio: { weight: 0.152, direction: 1 },
      unemployment_rate_yoy: { weight: 0.057, direction: -1 },
      population_yoy: { weight: 0.054, direction: -1 },
      demand_score: { weight: 0.031, direction: 1 },
    },
    investoredge: {
      hotness_score: { weight: 0.317, direction: 1 },
      median_gross_rent: { weight: 0.315, direction: -1 },
      affordability_ratio: { weight: 0.188, direction: -1 },
      pending_ratio: { weight: 0.080, direction: 1 },
      homeownership_rate: { weight: 0.047, direction: 1 },
      population_yoy: { weight: 0.035, direction: -1 },
      unemployment_rate_yoy: { weight: 0.018, direction: -1 },
    },
    markethealth: {
      hotness_score: { weight: 0.416, direction: 1 },
      demand_score: { weight: 0.345, direction: 1 },
      pending_ratio: { weight: 0.239, direction: 1 },
    },
  },
  county: {
    homeready: {
      hotness_score: { weight: 0.403, direction: 1 },
      affordability_ratio: { weight: 0.132, direction: 1 },
      price_reduced_share: { weight: 0.119, direction: -1 },
      population_yoy: { weight: 0.102, direction: -1 },
      rent_price_ratio: { weight: 0.091, direction: 1 },
      pending_ratio: { weight: 0.072, direction: 1 },
      unemployment_rate_yoy: { weight: 0.049, direction: 1 },
      demand_score: { weight: 0.033, direction: 1 },
    },
    investoredge: {
      rent_price_ratio: { weight: 0.402, direction: 1 },
      hotness_score: { weight: 0.244, direction: 1 },
      affordability_ratio: { weight: 0.094, direction: 1 },
      price_reduced_share: { weight: 0.082, direction: -1 },
      population_yoy: { weight: 0.059, direction: -1 },
      pending_ratio: { weight: 0.054, direction: 1 },
      demand_score: { weight: 0.034, direction: 1 },
      unemployment_rate_yoy: { weight: 0.030, direction: 1 },
    },
    markethealth: {
      hotness_score: { weight: 0.533, direction: 1 },
      demand_score: { weight: 0.254, direction: 1 },
      pending_ratio: { weight: 0.213, direction: 1 },
    },
  },
  zip: {
    homeready: {
      hotness_score: { weight: 0.534, direction: 1 },
      demand_score: { weight: 0.184, direction: 1 },
      pending_ratio: { weight: 0.165, direction: 1 },
      active_listing_count_yy: { weight: 0.101, direction: 1 },
      price_reduced_count_yy: { weight: 0.016, direction: 1 },
    },
    investoredge: {
      hotness_score: { weight: 0.534, direction: 1 },
      demand_score: { weight: 0.184, direction: 1 },
      pending_ratio: { weight: 0.165, direction: 1 },
      active_listing_count_yy: { weight: 0.101, direction: 1 },
      price_reduced_count_yy: { weight: 0.016, direction: 1 },
    },
    markethealth: {
      hotness_score: { weight: 0.699, direction: 1 },
      demand_score: { weight: 0.301, direction: 1 },
    },
  },
};

const MODEL_CORRELATIONS: Record<GeoLevel, Record<ScoreType, number>> = {
  metro: { homeready: 0.69, investoredge: 0.79, markethealth: 0.56 },
  county: { homeready: 0.16, investoredge: 0.09, markethealth: 0.29 },
  zip: { homeready: 0.37, investoredge: 0.37, markethealth: 0.26 },
};

const SAMPLE_SIZE_SCORES: Record<GeoLevel, number> = {
  metro: 60,
  county: 80,
  zip: 100,
};

const GRADE_THRESHOLDS = [
  { min: 93, grade: 'A+' },
  { min: 87, grade: 'A' },
  { min: 83, grade: 'A-' },
  { min: 80, grade: 'B+' },
  { min: 73, grade: 'B' },
  { min: 70, grade: 'B-' },
  { min: 67, grade: 'C+' },
  { min: 60, grade: 'C' },
  { min: 55, grade: 'C-' },
  { min: 50, grade: 'D+' },
  { min: 43, grade: 'D' },
  { min: 40, grade: 'D-' },
  { min: 0, grade: 'F' },
];

function scoreToGrade(score: number): string {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) return threshold.grade;
  }
  return 'F';
}

function getConfidenceLevel(confidence: number): string {
  if (confidence >= 80) return 'HIGH';
  if (confidence >= 65) return 'MEDIUM';
  if (confidence >= 45) return 'LOW';
  return 'INSUFFICIENT';
}

// ============================================================================
// Z-Score Calculation
// ============================================================================

function calculateZScores(
  records: any[],
  metricNames: string[],
  idField: string,
): Map<string, Map<string, number>> {
  const zScores = new Map<string, Map<string, number>>();

  for (const record of records) {
    zScores.set(String(record[idField]), new Map());
  }

  for (const metricName of metricNames) {
    const values: number[] = [];
    for (const record of records) {
      const value = record[metricName];
      if (value !== null && value !== undefined && !isNaN(value)) {
        values.push(value);
      }
    }

    if (values.length < 2) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    if (std === 0) continue;

    for (const record of records) {
      const value = record[metricName];
      if (value !== null && value !== undefined && !isNaN(value)) {
        const id = String(record[idField]);
        zScores.get(id)!.set(metricName, (value - mean) / std);
      }
    }
  }

  return zScores;
}

function applyFormulaAndNormalize(
  records: any[],
  zScores: Map<string, Map<string, number>>,
  formula: Record<string, MetricWeight>,
  idField: string,
  geoLevel: GeoLevel,
  scoreType: ScoreType,
): Map<string, { score: number; confidence: number; metricsAvailable: number }> {
  const metricNames = Object.keys(formula);
  const rawScores: { id: string; rawScore: number; metricsAvailable: number }[] = [];

  for (const record of records) {
    const id = String(record[idField]);
    const locationZScores = zScores.get(id) || new Map();
    let rawScore = 0;
    let metricsAvailable = 0;

    for (const [metricName, metricDef] of Object.entries(formula)) {
      const zScore = locationZScores.get(metricName);
      if (zScore !== undefined) {
        rawScore += metricDef.direction * metricDef.weight * zScore;
        metricsAvailable++;
      }
    }

    rawScores.push({ id, rawScore, metricsAvailable });
  }

  // Min-max normalize raw scores to 0-100
  const scores = rawScores.map(r => r.rawScore);
  const minRaw = Math.min(...scores);
  const maxRaw = Math.max(...scores);

  const result = new Map<string, { score: number; confidence: number; metricsAvailable: number }>();
  const metricsTotal = metricNames.length;

  for (const r of rawScores) {
    let normalizedScore: number;
    if (maxRaw === minRaw) {
      normalizedScore = 50;
    } else {
      normalizedScore = ((r.rawScore - minRaw) / (maxRaw - minRaw)) * 100;
    }

    // Calculate confidence
    const dataCompleteness = (r.metricsAvailable / metricsTotal) * 100;
    const modelStrength = Math.min((MODEL_CORRELATIONS[geoLevel][scoreType] || 0.5) * 125, 100);
    const sampleSize = SAMPLE_SIZE_SCORES[geoLevel];
    const stability = 70;

    const confidence =
      dataCompleteness * 0.3 +
      modelStrength * 0.4 +
      sampleSize * 0.15 +
      stability * 0.15;

    result.set(r.id, {
      score: Math.round(normalizedScore * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
      metricsAvailable: r.metricsAvailable,
    });
  }

  return result;
}

// ============================================================================
// Geography Configuration
// ============================================================================

interface GeoConfig {
  geoLevel: GeoLevel;
  realtorTable: string;
  censusTable: string | null;
  economicTable: string | null;
  idColumn: string;
  nameColumn: string;
  priceColumn: string;
}

const GEO_CONFIGS: GeoConfig[] = [
  {
    geoLevel: 'metro',
    realtorTable: 'realtor_metro',
    censusTable: 'census_metro',
    economicTable: 'economic_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'cbsa_title',
    priceColumn: 'median_listing_price',
  },
  {
    geoLevel: 'county',
    realtorTable: 'realtor_county',
    censusTable: 'census_county',
    economicTable: 'economic_county',
    idColumn: 'county_fips',
    nameColumn: 'county_name',
    priceColumn: 'median_listing_price',
  },
  // ZIP data not yet available - uncomment when ready
  // {
  //   geoLevel: 'zip',
  //   realtorTable: 'realtor_zip',
  //   censusTable: null,
  //   economicTable: null,
  //   idColumn: 'postal_code',
  //   nameColumn: 'postal_code',
  //   priceColumn: 'median_listing_price',
  // },
];

// ============================================================================
// Data Fetching
// ============================================================================

async function getLatestPeriodDate(tableName: string): Promise<string | null> {
  const { data } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  return data?.[0]?.period_date || null;
}

async function fetchAllRecordsWithPagination(
  tableName: string,
  columns: string,
  periodDate: string,
): Promise<any[]> {
  const allRecords: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .eq('period_date', periodDate)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`  Error fetching from ${tableName} at offset ${offset}: ${error.message}`);
      break;
    }

    if (data && data.length > 0) {
      allRecords.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

async function fetchCensusData(
  tableName: string,
  idColumn: string,
  year: number,
): Promise<Map<string, any>> {
  const censusMap = new Map<string, any>();

  const { data } = await supabase
    .from(tableName)
    .select(`${idColumn}, population_yoy, median_gross_rent, homeownership_rate`)
    .eq('year', year);

  if (data) {
    for (const row of data) {
      const rowAny = row as Record<string, any>;
      censusMap.set(String(rowAny[idColumn]), row);
    }
  }

  return censusMap;
}

async function fetchEconomicData(
  tableName: string,
  idColumn: string,
  periodDate: string,
): Promise<Map<string, any>> {
  const economicMap = new Map<string, any>();

  const { data } = await supabase
    .from(tableName)
    .select(`${idColumn}, unemployment_rate_yoy`)
    .eq('period_date', periodDate);

  if (data) {
    for (const row of data) {
      const rowAny = row as Record<string, any>;
      economicMap.set(String(rowAny[idColumn]), row);
    }
  }

  return economicMap;
}

async function fetchAllDataForGeo(
  config: GeoConfig,
  periodDate: string,
): Promise<any[]> {
  // Fetch realtor data
  const realtorCols = [
    config.idColumn,
    config.nameColumn,
    config.priceColumn,
    'hotness_score',
    'demand_score',
    'pending_ratio',
    'price_reduced_share',
    'active_listing_count_yy',
    'price_reduced_count_yy',
  ].join(', ');

  const realtorData = await fetchAllRecordsWithPagination(
    config.realtorTable,
    realtorCols,
    periodDate,
  );

  if (realtorData.length === 0) return [];

  // Build location map
  const locationsMap = new Map<string, any>();
  for (const row of realtorData) {
    const id = String(row[config.idColumn]);
    locationsMap.set(id, {
      ...row,
      id,
      name: row[config.nameColumn] || id,
      median_price: row[config.priceColumn],
    });
  }

  // Fetch and merge census data
  if (config.censusTable) {
    const year = new Date(periodDate).getFullYear();
    const censusData = await fetchCensusData(config.censusTable, config.idColumn, year);

    for (const [id, census] of censusData) {
      const location = locationsMap.get(id);
      if (location) {
        location.population_yoy = census.population_yoy;
        location.median_gross_rent = census.median_gross_rent;
        location.homeownership_rate = census.homeownership_rate;
      }
    }
  }

  // Fetch and merge economic data
  if (config.economicTable) {
    const economicData = await fetchEconomicData(config.economicTable, config.idColumn, periodDate);

    for (const [id, economic] of economicData) {
      const location = locationsMap.get(id);
      if (location) {
        location.unemployment_rate_yoy = economic.unemployment_rate_yoy;
      }
    }
  }

  return Array.from(locationsMap.values());
}

// ============================================================================
// Score Calculation and Storage
// ============================================================================

async function insertScoresBatch(records: any[], batchSize = 500): Promise<{ success: number; errors: number }> {
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

async function calculateScoresForGeo(
  config: GeoConfig,
  periodDate: string,
): Promise<{ processed: number; errors: number }> {
  // Fetch all data
  const data = await fetchAllDataForGeo(config, periodDate);

  if (data.length === 0) {
    return { processed: 0, errors: 0 };
  }

  // Filter to records with at least some valid metrics
  const validData = data.filter(d =>
    d.hotness_score != null || d.pending_ratio != null || d.demand_score != null
  );

  if (validData.length === 0) {
    return { processed: 0, errors: 0 };
  }

  // Get formulas for this geography level
  const formulas = FORMULA_WEIGHTS[config.geoLevel];
  const scoreTypes: ScoreType[] = ['homeready', 'investoredge', 'markethealth'];
  const allScoreRecords: any[] = [];

  for (const scoreType of scoreTypes) {
    const formula = formulas[scoreType];
    const metricNames = Object.keys(formula);

    // Calculate z-scores
    const zScores = calculateZScores(validData, metricNames, 'id');

    // Apply formula and normalize
    const scores = applyFormulaAndNormalize(
      validData,
      zScores,
      formula,
      'id',
      config.geoLevel,
      scoreType,
    );

    // Create score records
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

  // Insert all scores
  const result = await insertScoresBatch(allScoreRecords);
  return { processed: result.success, errors: result.errors };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PROPERTYIQ SCORE CALCULATION - Z-SCORE METHODOLOGY          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Get latest period date from metro data
  const periodDate = await getLatestPeriodDate('realtor_metro');
  if (!periodDate) {
    console.error('No realtor data found');
    process.exit(1);
  }

  console.log(`📅 Period date: ${periodDate}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CALCULATING SCORES FOR ALL GEOGRAPHIES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const config of GEO_CONFIGS) {
    const startTime = Date.now();
    process.stdout.write(`  ${config.geoLevel.padEnd(8)}: fetching data... `);

    const result = await calculateScoresForGeo(config, periodDate);
    totalProcessed += result.processed;
    totalErrors += result.errors;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`${result.processed} scores saved (${elapsed}s)`);
  }

  console.log('');
  console.log(`  Total: ${totalProcessed} scores saved`);
  if (totalErrors > 0) {
    console.log(`  Errors: ${totalErrors}`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { count: v2Count } = await supabase
    .from('propertyiq_scores_v2')
    .select('*', { count: 'exact', head: true });

  console.log(`  propertyiq_scores_v2: ${v2Count?.toLocaleString()} total records`);

  // Breakdown by geography
  console.log('\n  Current period breakdown:');
  for (const geoLevel of ['metro', 'county', 'zip'] as GeoLevel[]) {
    const { count } = await supabase
      .from('propertyiq_scores_v2')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geoLevel)
      .eq('score_date', periodDate);
    console.log(`    ${geoLevel.padEnd(8)}: ${count?.toLocaleString() || 0}`);
  }

  // Show top 5 markets for each score type
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TOP 5 MARKETS BY SCORE');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const scoreType of ['homeready', 'investoredge', 'markethealth']) {
    const { data: topMarkets } = await supabase
      .from('propertyiq_scores_v2')
      .select('location_name, score, grade')
      .eq('geography', 'metro')
      .eq('score_type', scoreType)
      .eq('score_date', periodDate)
      .order('score', { ascending: false })
      .limit(5);

    console.log(`\n  📈 ${scoreType.toUpperCase()} (Metro):`);
    if (topMarkets) {
      for (const m of topMarkets) {
        const name = (m.location_name || '').substring(0, 40).padEnd(40);
        console.log(`     ${m.score.toFixed(1)} ${m.grade.padEnd(3)} ${name}`);
      }
    }
  }

  console.log('\n\n✅ Score calculation complete');
  console.log('   Scores saved to propertyiq_scores_v2 table');
}

main().catch(console.error);
