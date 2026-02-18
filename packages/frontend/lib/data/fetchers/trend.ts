/**
 * TREND DATA FETCHER
 *
 * Calculates trend data (current value, change, direction, sparkline) for metrics.
 * Uses the time series API with historyMonths parameter.
 */

import type { GeoLevel, TrendResult, TrendDirection } from '../types';
import { fetchTimeSeriesData } from './timeseries';
import { fetchAPIWithParams } from './base';
import { getMetricConfig } from '../registry-helpers';

/**
 * Fetch trend data for a specific metric, geography, and region.
 *
 * @param metricId - The metric ID
 * @param geoLevel - The geography level
 * @param regionId - The region identifier
 * @param months - Number of months for trend calculation (default: 3)
 * @returns Promise<TrendResult | null>
 */
export async function fetchTrendData(
  metricId: string,
  geoLevel: GeoLevel,
  regionId: string,
  months: number = 3
): Promise<TrendResult | null> {
  try {
    const response = await fetchTimeSeriesData(metricId, geoLevel, regionId, {
      historyMonths: months,
    });

    if (!response.success || response.data.length < 2) {
      // Return current value only if we have at least one data point
      if (response.data.length === 1) {
        return {
          currentValue: response.data[0].value,
          previousValue: null,
          percentChange: null,
          direction: 'stable',
          sparklineData: [response.data[0].value],
          label: null,
        };
      }
      return null;
    }

    // Sort by date ascending (oldest first)
    const sorted = [...response.data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const sparklineData = sorted.map(d => d.value);
    const firstValue = sorted[0].value;
    const lastValue = sorted[sorted.length - 1].value;

    // Calculate percent change
    let percentChange: number | null = null;
    if (firstValue !== 0) {
      percentChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
    }

    // Determine direction
    const direction: TrendDirection =
      percentChange === null ? 'stable' :
      percentChange > 0.5 ? 'up' :
      percentChange < -0.5 ? 'down' : 'stable';

    // Generate label based on metric format
    const config = getMetricConfig(metricId);
    const isPercentageMetric = config?.format === 'percent';

    let label: string | null = null;
    if (percentChange !== null) {
      if (isPercentageMetric) {
        // For percentage metrics, show percentage point difference
        const pointDiff = lastValue - firstValue;
        const sign = pointDiff > 0 ? '+' : '';
        label = `${sign}${pointDiff.toFixed(1)} pts`;
      } else {
        // For absolute metrics, show relative percentage change
        const sign = percentChange > 0 ? '+' : '';
        label = `${sign}${percentChange.toFixed(1)}%`;
      }
    }

    return {
      currentValue: lastValue,
      previousValue: firstValue,
      percentChange,
      direction,
      sparklineData,
      label,
    };
  } catch (error) {
    console.error(`Failed to fetch trend for ${metricId}:`, error);
    return null;
  }
}

/**
 * Batch fetch trends for multiple metrics
 *
 * @param metricIds - Array of metric IDs
 * @param geoLevel - The geography level
 * @param regionId - The region identifier
 * @param months - Number of months for trend calculation (default: 3)
 * @returns Promise<Record<string, TrendResult | null>>
 */
export async function fetchTrendDataBatch(
  metricIds: string[],
  geoLevel: GeoLevel,
  regionId: string,
  months: number = 3
): Promise<Record<string, TrendResult | null>> {
  const results: Record<string, TrendResult | null> = {};

  await Promise.all(
    metricIds.map(async (metricId) => {
      results[metricId] = await fetchTrendData(metricId, geoLevel, regionId, months);
    })
  );

  return results;
}

/**
 * Batch fetch trends via the server-side batch endpoint (single HTTP call).
 * Returns percent change and direction for all metrics at once.
 */
export interface BatchTrendEntry {
  current: number | null;
  prior: number | null;
  percentChange: number | null;
  direction: 'up' | 'down' | 'stable';
}

export async function fetchBatchTrendsServer(
  metricIds: string[],
  geoLevel: GeoLevel,
  regionId: string,
  months: number = 6,
): Promise<Record<string, BatchTrendEntry>> {
  if (metricIds.length === 0) return {};

  const response = await fetchAPIWithParams<{
    success: boolean;
    trends: Record<string, BatchTrendEntry>;
  }>(`/api/timeseries/batch/${geoLevel}/${regionId}`, {
    metrics: metricIds.join(','),
    historyMonths: months,
  });

  const trends = response.trends ?? {};

  // Apply asPercent conversion for absolute values (current/prior).
  // percentChange is a ratio so it's already correct.
  for (const [metricId, entry] of Object.entries(trends)) {
    const config = getMetricConfig(metricId);
    if (config?.asPercent && entry) {
      if (entry.current != null) entry.current = entry.current * 100;
      if (entry.prior != null) entry.prior = entry.prior * 100;
    }
  }

  return trends;
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
