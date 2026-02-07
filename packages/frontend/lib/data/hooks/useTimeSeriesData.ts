/**
 * TIME SERIES DATA HOOK
 *
 * React Query hook for fetching historical metric values.
 * Provides time series data for charts, trends, and historical analysis.
 */

import { useQuery } from '@tanstack/react-query';
import type { GeoLevel, TimeSeriesPoint, TimeSeriesResult } from '../types';
import { fetchTimeSeriesData } from '../fetchers';
import { useMetricAccess } from './useMetricAccess';
import type { UserTier } from '@/lib/entitlements';

export interface UseTimeSeriesDataOptions {
  /** Start date for the range (ISO format) */
  startDate?: string;
  /** End date for the range (ISO format) */
  endDate?: string;
  /** Limit number of data points */
  limit?: number;
  /** Number of months of history to fetch */
  historyMonths?: number;
  /** Skip the query */
  enabled?: boolean;
}

export interface UseTimeSeriesDataResult {
  /** Time series data points */
  data: TimeSeriesPoint[];
  /** Most recent value */
  current: number | null;
  /** Previous period value (for comparison) */
  prior: number | null;
  /** Percent change from prior to current */
  trendChange: number | undefined;
  /** Full result object */
  result: TimeSeriesResult | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
  /** Whether metric is gated by entitlements */
  gated: boolean;
  /** Tier required to unlock */
  tierRequired?: UserTier;
  /** Whether in preview mode */
  preview?: boolean;
  /** Preview limit (months of history for time series) */
  previewLimit?: number | null;
}

/**
 * Hook for fetching time series data for a metric.
 *
 * @param metricId - The metric identifier
 * @param geoLevel - Geography level
 * @param regionId - Specific region identifier
 * @param options - Query options
 *
 * @example
 * // Fetch last 12 months
 * const { data, current, trendChange } = useTimeSeriesData(
 *   'home_value',
 *   'county',
 *   '24001',
 *   { historyMonths: 12 }
 * );
 */
export function useTimeSeriesData(
  metricId: string,
  geoLevel: GeoLevel,
  regionId: string,
  options: UseTimeSeriesDataOptions = {}
): UseTimeSeriesDataResult {
  const { startDate, endDate, limit, historyMonths, enabled = true } = options;
  const access = useMetricAccess(metricId);

  // If metric is gated, return early without fetching
  if (access.gated) {
    return {
      data: [],
      current: null,
      prior: null,
      trendChange: undefined,
      result: null,
      isLoading: false,
      error: null,
      refetch: () => {},
      gated: true,
      tierRequired: access.tierRequired ?? undefined,
    };
  }

  const queryKey = [
    'timeseries',
    metricId,
    geoLevel,
    regionId,
    startDate,
    endDate,
    limit,
    historyMonths,
  ].filter((v) => v !== undefined);

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      fetchTimeSeriesData(metricId, geoLevel, regionId, {
        startDate,
        endDate,
        limit,
        historyMonths,
      }),
    enabled: enabled && !!metricId && !!geoLevel && !!regionId,
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
    gcTime: 4 * 60 * 60 * 1000,
  });

  // Extract computed values
  const data = result?.data ?? [];
  const current = result?.current ?? null;
  const prior = result?.prior ?? null;

  // Calculate trend change
  let trendChange: number | undefined;
  if (current !== null && prior !== null && prior !== 0) {
    trendChange = ((current - prior) / Math.abs(prior)) * 100;
  }

  return {
    data,
    current,
    prior,
    trendChange,
    result: result ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
    gated: false,
    preview: access.preview,
    previewLimit: access.previewLimit,
  };
}

/**
 * Hook for fetching available date range for a metric.
 * Useful for determining chart bounds and data availability.
 */
export function useAvailableDates(
  metricId: string,
  geoLevel: GeoLevel,
  options: { enabled?: boolean } = {}
): {
  minDate: string | null;
  maxDate: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { enabled = true } = options;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dates', metricId, geoLevel],
    queryFn: async () => {
      // Fetch all data to get date range
      // The API should ideally have a dedicated endpoint for this
      const result = await fetchTimeSeriesData(metricId, geoLevel, 'national');
      if (!result.data || result.data.length === 0) {
        return { minDate: null, maxDate: null };
      }
      const dates = result.data.map((d) => d.date).sort();
      return {
        minDate: dates[0],
        maxDate: dates[dates.length - 1],
      };
    },
    enabled: enabled && !!metricId && !!geoLevel,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - dates don't change often
  });

  return {
    minDate: data?.minDate ?? null,
    maxDate: data?.maxDate ?? null,
    isLoading,
    error: error as Error | null,
  };
}
