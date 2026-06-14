/**
 * useMarketFactorsData - Data binding layer for Market Factors panel
 *
 * Fetches current value and N-month trend for multiple metrics using the
 * unified time-series API with historyMonths parameter. This approach gets
 * the most recent data regardless of absolute dates (handles stale data gracefully).
 * Use this for any UI that needs "current + trend" for a list of metrics.
 */

'use client';

import { useQueries } from '@tanstack/react-query';
import { getMetricConfig, timeSeriesApi, type GeoLevel, useMarketSnapshot } from '@/lib/data';
import { formatValue } from '@/app/map/utils/metricUtils';

const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 hours
const IS_DEV = process.env.NODE_ENV === 'development';

export interface MarketFactorDatum {
  value: number | null;
  formattedValue: string;
  /** 3-month percent change (for display); null when no history */
  trendPercent: number | null;
  /** 'up' | 'down' | 'stable' for icons */
  trendDirection: 'up' | 'down' | 'stable';
  sparklineData: number[];
  source?: string | null;
  sourceGeoId?: string | null;
  sourceGeoLevel?: 'metro' | 'county' | 'zip' | 'state' | 'national' | null;
  isInherited?: boolean;
  isFallback?: boolean;
}

export interface UseMarketFactorsDataOptions {
  enabled?: boolean;
  months?: number;
}

/**
 * Fetch current value and 3-month trend for each metric via the data binding layer.
 * Uses the same getTimeSeries API as useDataCard (unified path).
 */
export function useMarketFactorsData(
  metricIds: string[],
  geoLevel: GeoLevel | null,
  regionId: string | null,
  options: UseMarketFactorsDataOptions = {}
): {
  data: Record<string, MarketFactorDatum>;
  loading: boolean;
  error: string | null;
} {
  const { enabled = true, months = 3 } = options;
  const stableMetricIds = metricIds;
  const provenanceGeoLevel = (geoLevel === 'metro' || geoLevel === 'county' || geoLevel === 'zip' || geoLevel === 'state')
    ? geoLevel
    : undefined;
  const { cards: provenanceCards } = useMarketSnapshot(
    provenanceGeoLevel,
    provenanceGeoLevel ? (regionId ?? undefined) : undefined,
    {
      enabled: enabled && !!regionId && !!provenanceGeoLevel,
      includeTrends: false,
    },
  );

  const queries = useQueries({
    queries: stableMetricIds.map((metricId) => ({
      queryKey: ['market-factor', metricId, geoLevel, regionId, months],
      queryFn: async (): Promise<{ metricId: string; points: { date: string; value: number }[] }> => {
        // Use historyMonths instead of date range filtering
        // This tells the backend to get the most recent N months of data
        // regardless of actual dates (handles stale data gracefully)
        const response = await timeSeriesApi.getTimeSeries(
          metricId,
          geoLevel!,
          regionId!,
          undefined,  // no startDate
          undefined,  // no endDate
          undefined,  // no limit
          months      // historyMonths - gets most recent N months
        );
        if (!response.success || !response.data?.length) {
          return { metricId, points: [] };
        }
        return { metricId, points: response.data as { date: string; value: number }[] };
      },
      staleTime: CACHE_TIME,
      gcTime: CACHE_TIME,
      enabled: enabled && !!geoLevel && !!regionId && stableMetricIds.length > 0,
    })),
  });

  const loading = queries.some((q) => q.isLoading);
  const firstError = queries.find((q) => q.error)?.error;
  const error = firstError ? (firstError instanceof Error ? firstError.message : 'Failed to load') : null;

  const data: Record<string, MarketFactorDatum> = {};
  stableMetricIds.forEach((metricId, i) => {
    const config = getMetricConfig(metricId);
    const raw = queries[i]?.data as { metricId: string; points: { date: string; value: number }[] } | undefined;
    const points = raw?.points ?? [];

    // No data for this metric — don't include in output
    // Warn in dev so missing data is debuggable (not silently hidden)
    if (!points.length) {
      if (IS_DEV && geoLevel && regionId && queries[i]?.isFetched) {
        console.warn(`[useMarketFactorsData] ${metricId} returned no data for ${geoLevel}/${regionId}`);
      }
      return;
    }

    const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const currentValue = sorted[sorted.length - 1]?.value ?? null;
    const firstValue = sorted[0]?.value;
    const sparklineData = sorted.map((d) => d.value);

    let trendPercent: number | null = null;
    if (firstValue != null && firstValue !== 0 && currentValue != null) {
      trendPercent = ((currentValue - firstValue) / Math.abs(firstValue)) * 100;
      // Cap extreme trend percentages to ±99% for better UX
      // Large swings happen with small base values (e.g., YoY metrics going from 0.1% to 0.5%)
      // Showing +400% is technically correct but not useful to users
      if (Math.abs(trendPercent) > 99) {
        trendPercent = Math.sign(trendPercent) * 99;
      }
    }
    const trendDirection: 'up' | 'down' | 'stable' =
      trendPercent == null ? 'stable' : trendPercent > 0.5 ? 'up' : trendPercent < -0.5 ? 'down' : 'stable';

    const format = config?.format ?? 'number';
    const formattedValue = currentValue != null ? formatValue(currentValue, format) : '\u2014';

    data[metricId] = {
      value: currentValue,
      formattedValue,
      trendPercent,
      trendDirection,
      sparklineData,
      source: provenanceCards[metricId]?.source ?? null,
      sourceGeoId: provenanceCards[metricId]?.sourceGeoId ?? null,
      sourceGeoLevel: provenanceCards[metricId]?.sourceGeoLevel ?? null,
      isInherited: provenanceCards[metricId]?.isInherited ?? false,
      isFallback: provenanceCards[metricId]?.isFallback ?? false,
    };
  });

  return { data, loading, error };
}

export default useMarketFactorsData;
