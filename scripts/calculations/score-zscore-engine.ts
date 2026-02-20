/**
 * Z-Score Calculation and Formula Normalization Engine.
 *
 * Implements the core scoring math:
 *   1. Calculate z-scores for each metric across all locations
 *   2. Apply weighted formula (direction * weight * z-score)
 *   3. Min-max normalize raw scores to 0-100
 *   4. Calculate confidence from data completeness, model strength, sample size
 */

import {
  type GeoLevel,
  type ScoreType,
  type MetricWeight,
  MODEL_CORRELATIONS,
  SAMPLE_SIZE_SCORES,
} from './score-formula-weights';

// ---------------------------------------------------------------------------
// Z-Score Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate z-scores for each metric across all records.
 * Returns a Map: locationId -> Map<metricName, zScore>.
 */
export function calculateZScores(
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

// ---------------------------------------------------------------------------
// Formula Application + Normalization
// ---------------------------------------------------------------------------

export interface ScoreResult {
  score: number;
  confidence: number;
  metricsAvailable: number;
}

/**
 * Apply weighted formula to z-scores and normalize to 0-100.
 * Also calculates confidence for each location.
 */
export function applyFormulaAndNormalize(
  records: any[],
  zScores: Map<string, Map<string, number>>,
  formula: Record<string, MetricWeight>,
  idField: string,
  geoLevel: GeoLevel,
  scoreType: ScoreType,
): Map<string, ScoreResult> {
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

  const result = new Map<string, ScoreResult>();
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
