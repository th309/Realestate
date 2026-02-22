'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchScore, type ScoreResponse } from '@/lib/data';
import type { GeoLevel, ViewMode, SelectedGeography } from '../types';
import type { TrendDirection } from '../components/sidebar-components/TrendArrow';

// Local type definitions (these components were removed)
interface PricingData {
  medianPrice: string;
  progress: number;
  changeDescription: string;
}

interface InventoryData {
  supplyMonths: string;
  level: 'Low' | 'Medium' | 'High';
  progress: number;
  description: string;
}

interface InsightData {
  text: string;
}

interface MarketFactor {
  id: string;
  label: string;
  value: string;
  icon: string;
}

interface RightPanelData {
  // Score data
  score?: number;
  scoreTrend?: {
    direction: TrendDirection;
    value: string;
  };
  confidence?: 'a' | 'b' | 'c' | 'f';
  scoreInterpretation?: string;
  // Contextual data
  pricing?: PricingData;
  inventory?: InventoryData;
  insight?: InsightData;
  // Market factors
  marketFactors: MarketFactor[];
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
 * Get trend direction from change value
 */
function getTrend(change: number, threshold = 0.5): TrendDirection {
  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'flat';
}

/**
 * Get confidence level based on data completeness
 */
function getConfidenceLevel(completeness: number): 'a' | 'b' | 'c' | 'f' {
  if (completeness >= 90) return 'a';
  if (completeness >= 70) return 'b';
  if (completeness >= 50) return 'c';
  return 'f';
}

/**
 * Get inventory level description
 */
function getInventoryLevel(months: number): 'Low' | 'Medium' | 'High' {
  if (months < 4) return 'Low';
  if (months < 6) return 'Medium';
  return 'High';
}

/**
 * Generate investment insight based on market conditions
 */
function generateInsight(
  viewMode: ViewMode,
  score?: number
): string {
  const isHomebuyer = viewMode === 'homebuyer';

  if (score === undefined) {
    return isHomebuyer
      ? 'Explore market conditions and trends to make informed decisions about your home purchase.'
      : 'Analyze market fundamentals and historical performance to identify investment opportunities.';
  }

  if (score >= 80) {
    if (isHomebuyer) {
      return 'Market conditions are highly favorable for buyers. Strong inventory levels and stable pricing create excellent negotiating opportunities.';
    }
    return 'Strong fundamentals with solid rental demand and appreciation potential. Consider strategic acquisitions in this market.';
  }

  if (score >= 60) {
    if (isHomebuyer) {
      return 'Good market conditions with reasonable pricing. Take time to find the right property as inventory remains steady.';
    }
    return 'Favorable risk-reward profile with moderate growth potential. Focus on properties with strong rental history.';
  }

  if (score >= 40) {
    if (isHomebuyer) {
      return 'Market conditions are balanced. Patience and thorough research will help identify the best opportunities.';
    }
    return 'Mixed signals suggest careful due diligence. Look for undervalued properties with improvement potential.';
  }

  if (isHomebuyer) {
    return 'Challenging market conditions. Consider expanding your search area or waiting for more favorable timing.';
  }
  return 'Higher risk environment requires selective approach. Focus on cash flow positive opportunities with margin of safety.';
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
      // Fetch score from scoring API using the data layer
      const scoringType = mapGeoLevelToScoringType(geoLevel);
      const scoreResponse = await fetchScore(scoringType, geography.id);

      // Get the appropriate score based on view mode
      const score = scoreResponse
        ? (viewMode === 'homebuyer'
            ? scoreResponse.scores?.homeready?.score
            : scoreResponse.scores?.investoredge?.score)
        : undefined;

      // Calculate confidence based on data completeness
      // In production, this would come from the API response
      const dataCompleteness = scoreResponse ? 85 : 50;
      const confidence = getConfidenceLevel(dataCompleteness);

      // Generate trend (in production, this would come from historical data)
      const trendChange = Math.random() * 6 - 2; // -2 to +4 for demo
      const scoreTrend = score !== undefined ? {
        direction: getTrend(trendChange),
        value: `${trendChange >= 0 ? '+' : ''}${trendChange.toFixed(1)}%`
      } : undefined;

      // Generate contextual data (in production, these would be fetched from the API)
      // For now, we generate realistic demo data
      const medianPrice = 350000 + Math.random() * 450000;
      const priceYoy = Math.random() * 20 - 5;
      const supplyMonths = 2 + Math.random() * 6;

      const pricing: PricingData = {
        medianPrice: formatCurrency(medianPrice),
        progress: Math.min(100, Math.max(0, (priceYoy + 10) * 5)), // Normalize to 0-100
        changeDescription: `${priceYoy >= 0 ? 'Up' : 'Down'} ${Math.abs(priceYoy).toFixed(0)}% compared to last year.`
      };

      const inventoryLevel = getInventoryLevel(supplyMonths);
      const inventory: InventoryData = {
        supplyMonths: `${supplyMonths.toFixed(1)} mo`,
        level: inventoryLevel,
        progress: Math.min(100, (supplyMonths / 10) * 100),
        description: inventoryLevel === 'Low'
          ? "Current supply is trending towards a seller's market."
          : inventoryLevel === 'High'
            ? "Buyer's market with ample inventory choices."
            : 'Balanced market conditions with steady supply.'
      };

      const insight: InsightData = {
        text: generateInsight(viewMode, score)
      };

      // Generate market factors
      const marketFactors: MarketFactor[] = [
        {
          id: 'appreciation',
          label: 'Appreciation',
          value: score ? (score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low') + ` (${Math.round(60 + Math.random() * 35)}/100)` : '\u2014',
          icon: 'trending_up'
        },
        {
          id: 'yield',
          label: 'Yield Potential',
          value: viewMode === 'investor' ? `${(4 + Math.random() * 4).toFixed(1)}% Cap Rate` : `Medium (${Math.round(50 + Math.random() * 30)}/100)`,
          icon: 'query_stats'
        },
        {
          id: 'risk',
          label: 'Risk Level',
          value: score ? (score >= 60 ? 'Low Risk' : score >= 40 ? 'Moderate' : 'Higher Risk') : '\u2014',
          icon: 'verified'
        },
        {
          id: 'demand',
          label: 'Demand',
          value: score ? (score >= 70 ? 'Very Strong' : score >= 50 ? 'Strong' : score >= 30 ? 'Moderate' : 'Weak') : '\u2014',
          icon: 'groups'
        }
      ];

      setData({
        score,
        scoreTrend,
        confidence,
        pricing,
        inventory,
        insight,
        marketFactors,
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

export type { RightPanelData };
