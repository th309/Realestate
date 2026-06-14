/**
 * Trend Calculation Utilities
 *
 * Provides utilities for calculating 3-month trends from time series data.
 * Used by the data binding layer for real-time trend calculations.
 */

import { timeSeriesApi, type GeoLevel, type TimeSeriesDataPoint } from '@/lib/data';

export interface TrendData {
  /** Array of values for sparkline (most recent last) */
  sparklineData: number[];
  /** Percentage change over the period */
  percentChange: number | null;
  /** Current value */
  currentValue: number | null;
  /** Direction of trend */
  direction: 'up' | 'down' | 'stable';
}

/**
 * Calculate 3-month trend data for a metric
 */
export async function calculate3MonthTrend(
  metricId: string,
  geoLevel: GeoLevel,
  regionId: string
): Promise<TrendData | null> {
  try {
    // Use historyMonths instead of date range filtering
    // This gets the most recent 3 months of data regardless of actual dates
    const response = await timeSeriesApi.getTimeSeries(
      metricId,
      geoLevel,
      regionId,
      undefined,  // no startDate
      undefined,  // no endDate
      undefined,  // no limit
      3           // historyMonths - gets most recent 3 months
    );

    if (!response.success || response.data.length < 2) {
      return null;
    }

    // Sort by date ascending (oldest first)
    const sorted = [...response.data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const sparklineData = sorted.map(d => d.value);
    const firstValue = sorted[0].value;
    const lastValue = sorted[sorted.length - 1].value;

    const percentChange = firstValue !== 0
      ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100
      : null;

    const direction: 'up' | 'down' | 'stable' =
      percentChange === null ? 'stable' :
      percentChange > 0.5 ? 'up' :
      percentChange < -0.5 ? 'down' : 'stable';

    return {
      sparklineData,
      percentChange,
      currentValue: lastValue,
      direction,
    };
  } catch (error) {
    console.error(`Failed to calculate trend for ${metricId}:`, error);
    return null;
  }
}

/**
 * Batch calculate trends for multiple metrics
 */
export async function calculateTrendsBatch(
  metrics: { id: string; metricId: string }[],
  geoLevel: GeoLevel,
  regionId: string
): Promise<Record<string, TrendData | null>> {
  const results: Record<string, TrendData | null> = {};

  await Promise.all(
    metrics.map(async ({ id, metricId }) => {
      results[id] = await calculate3MonthTrend(metricId, geoLevel, regionId);
    })
  );

  return results;
}

/**
 * Normalize sparkline data to 0-1 range for rendering
 */
export function normalizeSparklineData(data: number[]): number[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) return data.map(() => 0.5);

  return data.map(v => (v - min) / range);
}
