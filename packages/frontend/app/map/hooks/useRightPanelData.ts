'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ScoreResponse } from '@/lib/api/client';
import type { GeoLevel, ViewMode, SelectedGeography } from '../types';
import type { TrendDirection } from '../components/sidebar-components/TrendArrow';
import type { MarketCondition } from '../components/sidebar-components/MarketConditionBadge';
import { getMarketCondition } from '../components/sidebar-components/MarketConditionBadge';

interface MetricData {
  value: string;
  label: string;
  percentile?: number;
  trend?: {
    direction: TrendDirection;
    value: string;
    comparison: string;
  };
  invertColors?: boolean;
}

interface RightPanelData {
  score?: number;
  scoreTrend?: {
    direction: TrendDirection;
    value: string;
  };
  marketCondition: MarketCondition;
  summaryText?: string;
  metrics: MetricData[];
}

interface UseRightPanelDataReturn {
  data: RightPanelData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Format currency value for display
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Format percent value for display
 */
function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Format days for display
 */
function formatDays(value: number): string {
  return `${Math.round(value)} days`;
}

/**
 * Format number with commas
 */
function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Get trend direction from change value
 */
function getTrend(change: number, threshold = 0.5): TrendDirection {
  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'flat';
}

/**
 * Generate summary text based on market data
 */
function generateSummaryText(
  geographyName: string,
  daysOnMarket?: number,
  inventoryYoy?: number,
  priceYoy?: number,
  marketCondition?: MarketCondition
): string {
  const parts: string[] = [];

  // DOM insight
  if (daysOnMarket !== undefined) {
    if (daysOnMarket < 21) {
      parts.push(`Homes sell fast here, typically in ${Math.round(daysOnMarket)} days`);
    } else if (daysOnMarket > 45) {
      parts.push(`Homes take longer to sell here, around ${Math.round(daysOnMarket)} days`);
    }
  }

  // Inventory insight
  if (inventoryYoy !== undefined) {
    if (inventoryYoy > 15) {
      parts.push('inventory rising significantly');
    } else if (inventoryYoy < -10) {
      parts.push('inventory tightening');
    }
  }

  // Price insight
  if (priceYoy !== undefined) {
    if (priceYoy > 5) {
      parts.push('prices climbing');
    } else if (priceYoy < -2) {
      parts.push('prices softening');
    }
  }

  // Market condition summary
  if (marketCondition === 'buyers') {
    parts.push('buyers gaining leverage');
  } else if (marketCondition === 'sellers') {
    parts.push('competitive market for buyers');
  }

  if (parts.length === 0) {
    return `Explore market conditions in ${geographyName}.`;
  }

  // Capitalize first letter and join
  const summary = parts.join(', ');
  return summary.charAt(0).toUpperCase() + summary.slice(1) + '.';
}

/**
 * Map geo level to scoring API geography type
 */
function mapGeoLevelToScoringType(geoLevel: GeoLevel): string {
  switch (geoLevel) {
    case 'state':
      return 'state';
    case 'metro':
      return 'metro';
    case 'county':
      return 'county';
    case 'zip':
      return 'zip';
    default:
      return 'metro';
  }
}

/**
 * Hook to fetch data for the right detail panel
 */
export function useRightPanelData(
  geography: SelectedGeography | null,
  geoLevel: GeoLevel,
  viewMode: ViewMode
): UseRightPanelDataReturn {
  const [data, setData] = useState<RightPanelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!geography) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch score from scoring API
      const scoringType = mapGeoLevelToScoringType(geoLevel);
      const scoreResponse = await api.getScore(scoringType, geography.id);

      // Get the appropriate score based on view mode
      const score = scoreResponse
        ? (viewMode === 'homebuyer' ? scoreResponse.homereadyScore : scoreResponse.investoredgeScore)
        : undefined;

      // For now, we'll use placeholder data for metrics until we fetch actual data
      // In production, you'd fetch the actual metric values for this geography
      const metrics: MetricData[] = [];

      // Determine market condition (placeholder - would use actual data)
      const marketCondition = getMarketCondition(undefined, undefined, undefined);

      // Generate summary text
      const summaryText = generateSummaryText(
        geography.name,
        undefined, // daysOnMarket
        undefined, // inventoryYoy
        undefined, // priceYoy
        marketCondition
      );

      setData({
        score,
        scoreTrend: score !== undefined ? { direction: 'flat', value: '' } : undefined,
        marketCondition,
        summaryText,
        metrics,
      });
    } catch (err) {
      console.error('Failed to fetch right panel data:', err);
      setError('Failed to load market data');
    } finally {
      setIsLoading(false);
    }
  }, [geography, geoLevel, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

export type { RightPanelData, MetricData };
