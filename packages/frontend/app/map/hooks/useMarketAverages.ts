'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GeoLevel } from '@/lib/data';

interface MetricAverage {
  metricId: string;
  nationalAvg: number;
  stateAvg?: number;
  metroAvg?: number;
}

interface MarketAverages {
  homeValue: MetricAverage;
  daysOnMarket: MetricAverage;
  homeValueYoy: MetricAverage;
  inventory: MetricAverage;
  pricePerSqft: MetricAverage;
  rentPrice: MetricAverage;
}

interface UseMarketAveragesReturn {
  averages: MarketAverages | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Default national averages (fallback values based on typical US market data)
const DEFAULT_AVERAGES: MarketAverages = {
  homeValue: {
    metricId: 'home_value',
    nationalAvg: 420000,
  },
  daysOnMarket: {
    metricId: 'days_on_market',
    nationalAvg: 35,
  },
  homeValueYoy: {
    metricId: 'home_value_yoy',
    nationalAvg: 3.5,
  },
  inventory: {
    metricId: 'for_sale_inventory',
    nationalAvg: 5000,
  },
  pricePerSqft: {
    metricId: 'price_per_sqft',
    nationalAvg: 225,
  },
  rentPrice: {
    metricId: 'rent_price',
    nationalAvg: 1850,
  },
};

/**
 * Hook to fetch market averages for comparison
 * Provides national and optional state/metro averages for key metrics
 */
export function useMarketAverages(
  geoLevel: GeoLevel,
  stateCode?: string
): UseMarketAveragesReturn {
  const [averages, setAverages] = useState<MarketAverages | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAverages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For now, use default averages
      // In production, you would fetch actual aggregate data from the API
      // e.g., GET /api/statistics/averages?level=national
      // or GET /api/statistics/averages?level=state&state=VA

      const updatedAverages = { ...DEFAULT_AVERAGES };

      // If we have a state code, we could fetch state-level averages
      if (stateCode) {
        // Placeholder: In production, fetch state averages
        // const stateData = await api.getStateAverages(stateCode);
        // updatedAverages.homeValue.stateAvg = stateData.homeValue;
        // etc.
      }

      setAverages(updatedAverages);
    } catch (err) {
      console.error('Failed to fetch market averages:', err);
      setError('Failed to load market averages');
      // Fall back to defaults on error
      setAverages(DEFAULT_AVERAGES);
    } finally {
      setIsLoading(false);
    }
  }, [stateCode]);

  useEffect(() => {
    fetchAverages();
  }, [fetchAverages]);

  return {
    averages,
    isLoading,
    error,
    refetch: fetchAverages,
  };
}

/**
 * Calculate percentile rank of a value compared to average
 * Returns 0-100 where 50 is average
 */
export function calculatePercentile(
  value: number,
  average: number,
  higherIsBetter: boolean = true
): number {
  if (average === 0) return 50;

  const ratio = value / average;

  // Convert ratio to percentile (0-100)
  // ratio of 1.0 = 50th percentile (average)
  // ratio of 2.0 = ~90th percentile
  // ratio of 0.5 = ~10th percentile
  let percentile = 50 + (ratio - 1) * 40;

  // Clamp to 0-100
  percentile = Math.max(0, Math.min(100, percentile));

  // If lower is better (e.g., days on market), invert
  if (!higherIsBetter) {
    percentile = 100 - percentile;
  }

  return Math.round(percentile);
}

/**
 * Format comparison text
 */
export function formatComparison(
  value: number,
  average: number,
  format: 'percent' | 'absolute' | 'days' = 'percent'
): string {
  const diff = value - average;
  const percentDiff = average !== 0 ? ((value - average) / average) * 100 : 0;

  if (format === 'days') {
    const daysDiff = Math.abs(Math.round(diff));
    return diff > 0 ? `+${daysDiff}d vs avg` : `-${daysDiff}d vs avg`;
  }

  if (format === 'absolute') {
    return diff >= 0 ? `+${Math.abs(diff).toFixed(0)} vs avg` : `-${Math.abs(diff).toFixed(0)} vs avg`;
  }

  // percent format
  return percentDiff >= 0
    ? `+${Math.abs(percentDiff).toFixed(1)}% vs avg`
    : `-${Math.abs(percentDiff).toFixed(1)}% vs avg`;
}

export type { MarketAverages, MetricAverage };
