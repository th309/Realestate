/**
 * Supabase Edge Function: Calculate PropertyIQ Scores
 *
 * This function calculates scores for all locations at a given geography level.
 * It implements the z-score standardization methodology from SCORING_SYSTEM_SPEC.md.
 *
 * Usage:
 *   POST /functions/v1/calculate-scores
 *   Body: { "geography": "metro" | "county" | "zip", "periodDate": "YYYY-MM-DD" }
 *
 * Can be triggered:
 * 1. Manually via HTTP POST
 * 2. By Supabase cron schedule (monthly)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Types
type ScoreType = 'homeready' | 'investoredge' | 'markethealth';
type GeographyLevel = 'metro' | 'county' | 'zip';

interface MetricWeight {
  weight: number;
  direction: 1 | -1;
}

interface FormulaDefinition {
  [metricName: string]: MetricWeight;
}

interface LocationMetrics {
  location_id: string;
  location_name: string;
  median_price?: number;
  hotness_score?: number;
  demand_score?: number;
  pending_ratio?: number;
  price_reduced_share?: number;
  active_listing_count_yy?: number;
  price_reduced_count_yy?: number;
  population_yoy?: number;
  unemployment_rate_yoy?: number;
  median_gross_rent?: number;
  homeownership_rate?: number;
  affordability_ratio?: number;
  rent_price_ratio?: number;
}

// Formula weights from SCORING_SYSTEM_SPEC.md
const FORMULA_WEIGHTS: Record<GeographyLevel, Record<ScoreType, FormulaDefinition>> = {
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

// Grade thresholds
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

// Model correlations for confidence
const MODEL_CORRELATIONS: Record<GeographyLevel, Record<ScoreType, number>> = {
  metro: { homeready: 0.69, investoredge: 0.79, markethealth: 0.56 },
  county: { homeready: 0.16, investoredge: 0.09, markethealth: 0.29 },
  zip: { homeready: 0.37, investoredge: 0.37, markethealth: 0.26 },
};

const SAMPLE_SIZE_SCORES: Record<GeographyLevel, number> = {
  metro: 60,
  county: 80,
  zip: 100,
};

// Helper functions
function scoreToGrade(score: number): string {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) return threshold.grade;
  }
  return 'F';
}

function getConfidenceLevel(score: number): string {
  if (score >= 80) return 'HIGH';
  if (score >= 65) return 'MEDIUM';
  if (score >= 45) return 'LOW';
  return 'INSUFFICIENT';
}

function getRealtorTable(geography: GeographyLevel): string {
  return `realtor_${geography}`;
}

function getIdColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro': return 'cbsa_code';
    case 'county': return 'county_fips';
    case 'zip': return 'postal_code';
  }
}

function getNameColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro': return 'cbsa_title';
    case 'county': return 'county_name';
    case 'zip': return 'zip_name';
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { geography, periodDate } = await req.json();

    if (!geography || !['metro', 'county', 'zip'].includes(geography)) {
      return new Response(
        JSON.stringify({ error: 'Invalid geography. Must be metro, county, or zip.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geoLevel = geography as GeographyLevel;
    const table = getRealtorTable(geoLevel);
    const idCol = getIdColumn(geoLevel);
    const nameCol = getNameColumn(geoLevel);

    // Get target date
    let targetDate = periodDate;
    if (!targetDate) {
      const { data: latestData } = await supabase
        .from(table)
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1);
      targetDate = latestData?.[0]?.period_date;
    }

    if (!targetDate) {
      return new Response(
        JSON.stringify({ error: 'No data found for this geography.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all Realtor data
    const { data: realtorData } = await supabase
      .from(table)
      .select(`${idCol}, ${nameCol}, hotness_score, demand_score, pending_ratio, price_reduced_share, active_listing_count_yy, price_reduced_count_yy, median_listing_price`)
      .eq('period_date', targetDate);

    if (!realtorData || realtorData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data found for the specified date.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build location metrics
    const locations: LocationMetrics[] = realtorData.map((row: any) => ({
      location_id: row[idCol],
      location_name: row[nameCol] || row[idCol],
      median_price: row.median_listing_price,
      hotness_score: row.hotness_score,
      demand_score: row.demand_score,
      pending_ratio: row.pending_ratio,
      price_reduced_share: row.price_reduced_share,
      active_listing_count_yy: row.active_listing_count_yy,
      price_reduced_count_yy: row.price_reduced_count_yy,
    }));

    // Get all unique metric names for this geography
    const allMetrics = new Set<string>();
    for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as ScoreType[]) {
      for (const metric of Object.keys(FORMULA_WEIGHTS[geoLevel][scoreType])) {
        allMetrics.add(metric);
      }
    }

    // Calculate z-scores for each metric
    type ZScoreMap = { [locationId: string]: { [metricName: string]: number } };
    const zScores: ZScoreMap = {};

    for (const location of locations) {
      zScores[location.location_id] = {};
    }

    for (const metricName of allMetrics) {
      const values: number[] = [];
      for (const location of locations) {
        const value = (location as any)[metricName];
        if (value !== null && value !== undefined && !isNaN(value)) {
          values.push(value);
        }
      }

      if (values.length < 2) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      if (std === 0) continue;

      for (const location of locations) {
        const value = (location as any)[metricName];
        if (value !== null && value !== undefined && !isNaN(value)) {
          zScores[location.location_id][metricName] = (value - mean) / std;
        }
      }
    }

    // Calculate scores for each score type
    let calculated = 0;
    let errors = 0;

    for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as ScoreType[]) {
      const formula = FORMULA_WEIGHTS[geoLevel][scoreType];
      const rawScores: { locationId: string; rawScore: number }[] = [];

      // Apply formula to get raw scores
      for (const location of locations) {
        const locationZScores = zScores[location.location_id] || {};
        let rawScore = 0;
        let totalWeight = 0;

        for (const [metricName, metricDef] of Object.entries(formula)) {
          const zScore = locationZScores[metricName];
          if (zScore !== undefined) {
            rawScore += metricDef.direction * metricDef.weight * zScore;
            totalWeight += metricDef.weight;
          }
        }

        if (totalWeight > 0 && totalWeight < 1) {
          rawScore = rawScore / totalWeight;
        }

        rawScores.push({ locationId: location.location_id, rawScore });
      }

      // Normalize to 0-100
      const scores = rawScores.map(r => r.rawScore);
      const minRaw = Math.min(...scores);
      const maxRaw = Math.max(...scores);

      const normalizedScores = rawScores.map(r => {
        if (maxRaw === minRaw) return 50;
        return Math.round(((r.rawScore - minRaw) / (maxRaw - minRaw)) * 100 * 10) / 10;
      });

      // Save scores
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        const score = normalizedScores[i];
        const grade = scoreToGrade(score);

        // Calculate confidence
        const metricNames = Object.keys(formula);
        const availableMetrics = metricNames.filter(
          m => (location as any)[m] !== null && (location as any)[m] !== undefined
        ).length;
        const completeness = (availableMetrics / metricNames.length) * 100;
        const modelStrength = Math.min(MODEL_CORRELATIONS[geoLevel][scoreType] * 125, 100);
        const sampleSizeScore = SAMPLE_SIZE_SCORES[geoLevel];
        const stability = location.hotness_score != null ? 80 : 60;
        const confidence = Math.round(
          (completeness * 0.30 + modelStrength * 0.40 + sampleSizeScore * 0.15 + stability * 0.15) * 10
        ) / 10;
        const confidenceLevel = getConfidenceLevel(confidence);

        const { error } = await supabase.from('propertyiq_scores').upsert(
          {
            geography: geoLevel,
            location_id: location.location_id,
            location_name: location.location_name,
            score_type: scoreType,
            score,
            grade,
            confidence,
            confidence_level: confidenceLevel,
            median_price: location.median_price,
            score_date: targetDate,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'geography,location_id,score_type,score_date' }
        );

        if (error) {
          errors++;
          console.error(`Error saving score: ${error.message}`);
        } else {
          calculated++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: errors === 0,
        geography: geoLevel,
        periodDate: targetDate,
        calculated,
        errors,
        locations: locations.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
