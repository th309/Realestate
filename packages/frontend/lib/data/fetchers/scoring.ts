/**
 * SCORING VALIDATION FETCHERS
 *
 * API functions for score validation and quintile performance data.
 */

import { fetchAPI, fetchAPIWithParams } from './base';

// ============================================================================
// TYPES
// ============================================================================

export type ValidationGeography = 'metro' | 'county' | 'zip';
export type ValidationScoreType = 'homeready' | 'investoredge' | 'markethealth';

export interface QuintilePerformanceData {
  [key: string]: unknown;
}

export interface ValidationSummary {
  totalScores: number;
  scoresWithOutcomes: number;
  avgScore: number;
  avgReturn1y: number;
  avgReturn3y: number;
  avgExcessVsState1y: number;
  avgExcessVsState3y: number;
  correlation1y: number;
  correlation3y: number;
  hitRate1y: number;
  hitRate3y: number;
  dataRange: { startDate: string; endDate: string };
}

export interface ValidationQuintile {
  quintile: number;
  label: string;
  scoreMin: number;
  scoreMax: number;
  avgScore: number;
  count: number;
  avgReturn1y: number | null;
  avgReturn3y: number | null;
  avgExcessVsState1y: number | null;
  avgExcessVsState3y: number | null;
  avgExcessVsNational1y: number | null;
  avgExcessVsNational3y: number | null;
}

export interface ValidationScatterPoint {
  geographyId: string;
  geographyName: string;
  scoreDate: string;
  score: number;
  return1y: number | null;
  return3y: number | null;
  excessVsState1y: number | null;
  excessVsState3y: number | null;
}

export interface ValidationTimeSeriesPoint {
  date: string;
  avgScore: number;
  avgActualReturn: number;
  correlation: number;
  hitRate: number;
  sampleSize: number;
}

export interface ValidationGeographyBreakdown {
  geographyType: 'metro' | 'county' | 'zip';
  totalScores: number;
  avgCorrelation1y: number;
  avgCorrelation3y: number;
  avgHitRate1y: number;
  avgHitRate3y: number;
  topPerformer: {
    id: string;
    name: string;
    score: number;
    excessReturn: number;
  } | null;
}

// ============================================================================
// FETCHERS
// ============================================================================

/**
 * Fetch quintile performance data for a given score type.
 */
export async function fetchQuintilePerformance<T = QuintilePerformanceData>(
  scoreType: string,
): Promise<T> {
  return fetchAPIWithParams<T>('/api/admin/scores/validation/quintile-performance', {
    score_type: scoreType,
  });
}

/**
 * Fetch report templates list.
 */
export async function fetchReportTemplates<T = unknown>(): Promise<T[]> {
  const data = await fetchAPI<T[]>('/api/reports/templates');
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch validation summary statistics.
 */
export async function fetchValidationSummary(params?: {
  geography?: ValidationGeography;
  score_type?: ValidationScoreType;
}): Promise<ValidationSummary> {
  return fetchAPIWithParams<ValidationSummary>('/api/admin/scores/validation/summary', params);
}

/**
 * Fetch quintile analysis data (detailed quintile breakdown).
 */
export async function fetchValidationQuintiles(params?: {
  geography?: ValidationGeography;
  score_type?: ValidationScoreType;
  horizon?: '1y' | '3y';
}): Promise<ValidationQuintile[]> {
  return fetchAPIWithParams<ValidationQuintile[]>('/api/admin/scores/validation/quintile-analysis', params);
}

/**
 * Fetch scatter plot data for score vs return visualization.
 */
export async function fetchValidationScatter(params?: {
  geography?: ValidationGeography;
  score_type?: ValidationScoreType;
  limit?: number;
}): Promise<ValidationScatterPoint[]> {
  return fetchAPIWithParams<ValidationScatterPoint[]>('/api/admin/scores/validation/scatter', params);
}

/**
 * Fetch time series of validation accuracy metrics.
 */
export async function fetchValidationTimeSeries(params?: {
  geography?: ValidationGeography;
  score_type?: ValidationScoreType;
}): Promise<ValidationTimeSeriesPoint[]> {
  return fetchAPIWithParams<ValidationTimeSeriesPoint[]>('/api/admin/scores/validation/time-series', params);
}

/**
 * Fetch validation breakdown by geography level.
 */
export async function fetchValidationGeography(params?: {
  score_type?: ValidationScoreType;
}): Promise<ValidationGeographyBreakdown[]> {
  return fetchAPIWithParams<ValidationGeographyBreakdown[]>('/api/admin/scores/validation/geography-breakdown', params);
}
