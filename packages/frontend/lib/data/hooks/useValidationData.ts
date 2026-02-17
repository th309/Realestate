/**
 * VALIDATION DATA HOOKS
 *
 * React Query hooks for score validation and accuracy data.
 * Used by the /scores/accuracy page for interactive charts.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchValidationSummary,
  fetchValidationQuintiles,
  fetchValidationScatter,
  fetchValidationTimeSeries,
  fetchValidationGeography,
} from '../fetchers';
import type {
  ValidationGeography,
  ValidationScoreType,
  ValidationSummary,
  ValidationQuintile,
  ValidationScatterPoint,
  ValidationTimeSeriesPoint,
  ValidationGeographyBreakdown,
} from '../fetchers';

// ============================================================================
// SUMMARY
// ============================================================================

export interface UseValidationSummaryOptions {
  geography?: ValidationGeography;
  scoreType?: ValidationScoreType;
  enabled?: boolean;
}

export function useValidationSummary(options: UseValidationSummaryOptions = {}) {
  const { geography, scoreType, enabled = true } = options;

  return useQuery<ValidationSummary>({
    queryKey: ['validation', 'summary', geography, scoreType],
    queryFn: () =>
      fetchValidationSummary({
        geography,
        score_type: scoreType,
      }),
    enabled,
    staleTime: 2 * 60 * 60 * 1000,
  });
}

// ============================================================================
// QUINTILE ANALYSIS
// ============================================================================

export interface UseValidationQuintilesOptions {
  geography?: ValidationGeography;
  scoreType?: ValidationScoreType;
  horizon?: '1y' | '3y';
  enabled?: boolean;
}

export function useValidationQuintiles(options: UseValidationQuintilesOptions = {}) {
  const { geography, scoreType, horizon = '1y', enabled = true } = options;

  return useQuery<ValidationQuintile[]>({
    queryKey: ['validation', 'quintiles', geography, scoreType, horizon],
    queryFn: () =>
      fetchValidationQuintiles({
        geography,
        score_type: scoreType,
        horizon,
      }),
    enabled,
    staleTime: 2 * 60 * 60 * 1000,
  });
}

// ============================================================================
// SCATTER
// ============================================================================

export interface UseValidationScatterOptions {
  geography?: ValidationGeography;
  scoreType?: ValidationScoreType;
  limit?: number;
  enabled?: boolean;
}

export function useValidationScatter(options: UseValidationScatterOptions = {}) {
  const { geography, scoreType, limit, enabled = true } = options;

  return useQuery<ValidationScatterPoint[]>({
    queryKey: ['validation', 'scatter', geography, scoreType, limit],
    queryFn: () =>
      fetchValidationScatter({
        geography,
        score_type: scoreType,
        limit,
      }),
    enabled,
    staleTime: 2 * 60 * 60 * 1000,
  });
}

// ============================================================================
// TIME SERIES
// ============================================================================

export interface UseValidationTimeSeriesOptions {
  geography?: ValidationGeography;
  scoreType?: ValidationScoreType;
  enabled?: boolean;
}

export function useValidationTimeSeries(options: UseValidationTimeSeriesOptions = {}) {
  const { geography, scoreType, enabled = true } = options;

  return useQuery<ValidationTimeSeriesPoint[]>({
    queryKey: ['validation', 'time-series', geography, scoreType],
    queryFn: () =>
      fetchValidationTimeSeries({
        geography,
        score_type: scoreType,
      }),
    enabled,
    staleTime: 2 * 60 * 60 * 1000,
  });
}

// ============================================================================
// GEOGRAPHY BREAKDOWN
// ============================================================================

export interface UseValidationGeographyOptions {
  scoreType?: ValidationScoreType;
  enabled?: boolean;
}

export function useValidationGeography(options: UseValidationGeographyOptions = {}) {
  const { scoreType, enabled = true } = options;

  return useQuery<ValidationGeographyBreakdown[]>({
    queryKey: ['validation', 'geography', scoreType],
    queryFn: () =>
      fetchValidationGeography({
        score_type: scoreType,
      }),
    enabled,
    staleTime: 2 * 60 * 60 * 1000,
  });
}
