/**
 * TREND DATA HOOK
 *
 * React Query hook for fetching trend calculations (change over time).
 * Provides current value, previous value, percent change, and sparkline data.
 */

import { useQuery, useQueries } from '@tanstack/react-query';
import type { GeoLevel, TrendResult, TrendDirection } from '../types';
import { fetchTrendData, fetchTrendDataBatch } from '../fetchers';
import { useMetricAccess } from './useMetricAccess';
import type { UserTier } from '@/lib/entitlements';

export interface UseTrendDataOptions {
  /** Number of months for trend calculation (default: 12) */
  months?: number;
  /** Skip the query */
  enabled?: boolean;
}

export interface UseTrendDataResult {
  /** Full trend result */
  trend: TrendResult | null;
  /** Current value */
  currentValue: number | null;
  /** Previous value */
  previousValue: number | null;
  /** Percent change */
  percentChange: number | null;
  /** Trend direction */
  direction: TrendDirection | null;
  /** Sparkline data points */
  sparklineData: number[];
  /** Human-readable trend label */
  label: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether metric is gated by entitlements */
  gated: boolean;
  /** Tier required to unlock */
  tierRequired?: UserTier;
}

/**
 * Hook for fetching trend data for a single metric.
 *
 * @param metricId - The metric identifier
 * @param geoLevel - Geography level
 * @param regionId - Specific region identifier
 * @param options - Query options
 *
 * @example
 * const { percentChange, direction, sparklineData } = useTrendData(
 *   'home_value',
 *   'county',
 *   '24001',
 *   { months: 12 }
 * );
 */
export function useTrendData(
  metricId: string,
  geoLevel: GeoLevel,
  regionId: string,
  options: UseTrendDataOptions = {}
): UseTrendDataResult {
  const { months = 12, enabled = true } = options;
  const access = useMetricAccess(metricId);

  const queryKey = ['trend', metricId, geoLevel, regionId, months];

  // IMPORTANT: Always call useQuery to maintain hook order consistency.
  // Use enabled: false to skip fetching when metric is gated.
  const {
    data: trend,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => fetchTrendData(metricId, geoLevel, regionId, months),
    enabled: enabled && !!metricId && !!geoLevel && !!regionId && !access.gated,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // If metric is gated, return gated result (after hooks have been called)
  if (access.gated) {
    return {
      trend: null,
      currentValue: null,
      previousValue: null,
      percentChange: null,
      direction: null,
      sparklineData: [],
      label: null,
      isLoading: false,
      error: null,
      gated: true,
      tierRequired: access.tierRequired ?? undefined,
    };
  }

  return {
    trend: trend ?? null,
    currentValue: trend?.currentValue ?? null,
    previousValue: trend?.previousValue ?? null,
    percentChange: trend?.percentChange ?? null,
    direction: trend?.direction ?? null,
    sparklineData: trend?.sparklineData ?? [],
    label: trend?.label ?? null,
    isLoading,
    error: error as Error | null,
    gated: false,
  };
}

/**
 * Hook for fetching trend data for multiple metrics at once.
 * Uses parallel queries for efficiency.
 *
 * @param metricIds - Array of metric identifiers
 * @param geoLevel - Geography level
 * @param regionId - Specific region identifier
 * @param options - Query options
 *
 * @example
 * const { trends, isLoading } = useTrendDataBatch(
 *   ['home_value', 'rent_price', 'inventory'],
 *   'county',
 *   '24001'
 * );
 * console.log(trends['home_value']?.percentChange);
 */
export function useTrendDataBatch(
  metricIds: string[],
  geoLevel: GeoLevel,
  regionId: string,
  options: UseTrendDataOptions = {}
): {
  trends: Record<string, TrendResult | null>;
  isLoading: boolean;
  hasError: boolean;
} {
  const { months = 12, enabled = true } = options;

  const queries = useQueries({
    queries: metricIds.map((metricId) => ({
      queryKey: ['trend', metricId, geoLevel, regionId, months],
      queryFn: () => fetchTrendData(metricId, geoLevel, regionId, months),
      enabled: enabled && !!geoLevel && !!regionId,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    })),
  });

  const trends: Record<string, TrendResult | null> = {};
  let hasError = false;

  queries.forEach((query, index) => {
    const metricId = metricIds[index];
    trends[metricId] = query.data ?? null;
    if (query.error) hasError = true;
  });

  const isLoading = queries.some((q) => q.isLoading);

  return {
    trends,
    isLoading,
    hasError,
  };
}

/**
 * Hook for fetching market factors data - common metrics for market analysis.
 * Pre-configured batch of key real estate metrics.
 */
export function useMarketFactorsTrends(
  geoLevel: GeoLevel,
  regionId: string,
  options: UseTrendDataOptions = {}
): {
  trends: Record<string, TrendResult | null>;
  isLoading: boolean;
  hasError: boolean;
} {
  const marketFactorMetrics = [
    'home_value',
    'rent_price',
    'inventory',
    'days_on_market',
    'price_reduced_pct',
    'list_price',
  ];

  return useTrendDataBatch(marketFactorMetrics, geoLevel, regionId, options);
}
