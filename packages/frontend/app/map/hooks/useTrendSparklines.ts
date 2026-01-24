'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { timeSeriesApi } from '@/lib/api/client';
import type { GeoLevel } from '../types';

export interface SparklineData {
  /** Array of values for sparkline (most recent last) */
  data: number[];
  /** Percentage change over the period */
  percentChange: number | null;
  /** Direction of trend */
  direction: 'up' | 'down' | 'stable';
}

interface UseTrendSparklinesOptions {
  /** Number of months for trend calculation */
  months?: number;
  /** Whether to fetch data */
  enabled?: boolean;
}

interface UseTrendSparklinesReturn {
  /** Sparkline data keyed by metric ID */
  sparklines: Record<string, SparklineData>;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook to fetch 3-month trend sparkline data for multiple metrics
 */
export function useTrendSparklines(
  metricIds: string[],
  geoLevel: GeoLevel | null,
  regionId: string | null,
  options: UseTrendSparklinesOptions = {}
): UseTrendSparklinesReturn {
  const { months = 3, enabled = true } = options;

  const [sparklines, setSparklines] = useState<Record<string, SparklineData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest request to avoid race conditions
  const latestRequestRef = useRef<string>('');

  const fetchSparklines = useCallback(async () => {
    if (!enabled || !geoLevel || !regionId || metricIds.length === 0) {
      setSparklines({});
      return;
    }

    const requestKey = `${geoLevel}:${regionId}:${metricIds.join(',')}`;
    latestRequestRef.current = requestKey;

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const endDate = now.toISOString().split('T')[0];
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - months,
        now.getDate()
      ).toISOString().split('T')[0];

      const results: Record<string, SparklineData> = {};

      await Promise.all(
        metricIds.map(async (metricId) => {
          try {
            const response = await timeSeriesApi.getTimeSeries(
              metricId,
              geoLevel,
              regionId,
              startDate,
              endDate
            );

            if (response.success && response.data.length >= 2) {
              // Sort by date ascending (oldest first)
              const sorted = [...response.data].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );

              const data = sorted.map(d => d.value);
              const firstValue = sorted[0].value;
              const lastValue = sorted[sorted.length - 1].value;

              const percentChange = firstValue !== 0
                ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100
                : null;

              const direction: 'up' | 'down' | 'stable' =
                percentChange === null ? 'stable' :
                percentChange > 0.5 ? 'up' :
                percentChange < -0.5 ? 'down' : 'stable';

              results[metricId] = { data, percentChange, direction };
            } else {
              results[metricId] = { data: [], percentChange: null, direction: 'stable' };
            }
          } catch {
            results[metricId] = { data: [], percentChange: null, direction: 'stable' };
          }
        })
      );

      // Only update if this is still the latest request
      if (latestRequestRef.current === requestKey) {
        setSparklines(results);
        setError(null);
      }
    } catch (err) {
      if (latestRequestRef.current === requestKey) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trend data');
      }
    } finally {
      if (latestRequestRef.current === `${geoLevel}:${regionId}:${metricIds.join(',')}`) {
        setLoading(false);
      }
    }
  }, [metricIds.join(','), geoLevel, regionId, months, enabled]);

  useEffect(() => {
    fetchSparklines();
  }, [fetchSparklines]);

  return { sparklines, loading, error };
}

export default useTrendSparklines;
