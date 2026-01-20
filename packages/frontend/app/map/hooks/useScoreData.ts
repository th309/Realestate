/**
 * useScoreData Hook
 *
 * Fetches PropertyIQ score data for a geography.
 * Supports all three score types: Market Health, HomeReady, InvestorEdge.
 *
 * Features:
 * - Fetches score data with component breakdown
 * - Handles loading and error states
 * - Supports expanded mode for detailed component data
 * - Caches recent requests to avoid refetching
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAPI } from '@/lib/api/client';

// Types
export type ScoreType = 'market_health' | 'homeready' | 'investoredge';
export type GeographyType = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';
export type ScoreAccess = 'full' | 'teaser';
export type TrendDirection = 'up' | 'down' | 'stable';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MetricDetail {
  name: string;
  value: number | null;
  normalizedScore: number | null;
  formatted: string;
  target?: string;
  isInherited: boolean;
  sourceGeographyType?: string;
  sourceGeographyName?: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ComponentDetail {
  name: string;
  label: string;
  weight: number;
  score: number;
  weightedContribution: number;
  description: string;
  metrics: MetricDetail[];
  helpingFactors: string[];
  hurtingFactors: string[];
}

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  percentage: number;
  metricsAvailable: number;
  metricsTotal: number;
  freshnessInDays: number;
  warning?: string;
}

export interface HistoryPoint {
  date: string;
  score: number | null;
}

export interface ScoreHistory {
  data: HistoryPoint[];
  months: number;
  trend: TrendDirection;
  change: number;
}

export interface UpgradeCta {
  headline: string;
  description: string;
  buttonText: string;
  upgradeUrl: string;
  requiredTier: string;
  features: string[];
}

export interface ScoreBadgeData {
  type: ScoreType;
  label: string;
  score: number | null;
  trend: TrendDirection;
  trendChange: number;
  access: ScoreAccess;
  status: 'complete' | 'partial' | 'unavailable';
  statusMessage?: string;
  periodDate: string;
}

export interface ScoreCardData extends ScoreBadgeData {
  components: ComponentDetail[];
  confidence: ConfidenceInfo;
  history?: ScoreHistory;
  dataCompleteness: number;
  inheritedMetricsCount: number;
  inheritedMetrics?: Record<string, string>;
}

export interface ScoreTeaserData extends ScoreBadgeData {
  lockedComponents: Array<{
    name: string;
    label: string;
    weight: number;
    blurredScore: string;
  }>;
  upgradeCta: UpgradeCta;
  teaserDescription?: string;
}

export interface AllScoresResponse {
  geographyId: string;
  geographyType: GeographyType;
  geographyName: string;
  stateCode?: string;
  periodDate: string;
  userTier: string;
  marketHealth: ScoreBadgeData | ScoreCardData;
  homeready: ScoreBadgeData | ScoreCardData | ScoreTeaserData;
  investoredge: ScoreBadgeData | ScoreCardData | ScoreTeaserData;
  calculatedAt: string;
  calculationVersion: string;
}

interface UseScoreDataOptions {
  expanded?: boolean;
  historyMonths?: number;
  userTier?: string;
}

interface UseScoreDataReturn {
  data: AllScoresResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Simple in-memory cache
const scoreCache = new Map<string, { data: AllScoresResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(
  geographyType: GeographyType,
  geographyId: string,
  options: UseScoreDataOptions
): string {
  return `${geographyType}:${geographyId}:${options.expanded}:${options.historyMonths}:${options.userTier}`;
}

function getCachedData(key: string): AllScoresResponse | null {
  const cached = scoreCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  scoreCache.delete(key);
  return null;
}

function setCachedData(key: string, data: AllScoresResponse): void {
  scoreCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Hook to fetch PropertyIQ score data for a geography
 */
export function useScoreData(
  geographyType: GeographyType | null,
  geographyId: string | null,
  options: UseScoreDataOptions = {}
): UseScoreDataReturn {
  const { expanded = false, historyMonths = 0, userTier } = options;

  const [data, setData] = useState<AllScoresResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest request to avoid race conditions
  const latestRequestRef = useRef<string | null>(null);

  const fetchScores = useCallback(async () => {
    if (!geographyType || !geographyId) {
      setData(null);
      setError(null);
      return;
    }

    const cacheKey = getCacheKey(geographyType, geographyId, options);
    latestRequestRef.current = cacheKey;

    // Check cache first
    const cached = getCachedData(cacheKey);
    if (cached) {
      setData(cached);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (expanded) params.append('expanded', 'true');
      if (historyMonths > 0) params.append('historyMonths', historyMonths.toString());

      const queryString = params.toString();
      const url = `/api/scoring/${geographyType}/${encodeURIComponent(geographyId)}${queryString ? `?${queryString}` : ''}`;

      // Add user tier header if provided
      const headers: HeadersInit = {};
      if (userTier) {
        headers['x-user-tier'] = userTier;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch scores: ${response.status}`);
      }

      const result = await response.json() as AllScoresResponse;

      // Only update if this is still the latest request
      if (latestRequestRef.current === cacheKey) {
        setCachedData(cacheKey, result);
        setData(result);
        setError(null);
      }
    } catch (err) {
      // Only update error if this is still the latest request
      if (latestRequestRef.current === cacheKey) {
        const message = err instanceof Error ? err.message : 'Failed to fetch score data';
        setError(message);
        setData(null);
      }
    } finally {
      if (latestRequestRef.current === cacheKey) {
        setLoading(false);
      }
    }
  }, [geographyType, geographyId, expanded, historyMonths, userTier]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return {
    data,
    loading,
    error,
    refetch: fetchScores,
  };
}

/**
 * Hook to fetch a single score type for a geography
 */
export function useSingleScore(
  geographyType: GeographyType | null,
  geographyId: string | null,
  scoreType: ScoreType,
  options: UseScoreDataOptions = {}
): {
  score: ScoreBadgeData | ScoreCardData | ScoreTeaserData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { data, loading, error, refetch } = useScoreData(geographyType, geographyId, options);

  let score: ScoreBadgeData | ScoreCardData | ScoreTeaserData | null = null;
  if (data) {
    switch (scoreType) {
      case 'market_health':
        score = data.marketHealth;
        break;
      case 'homeready':
        score = data.homeready;
        break;
      case 'investoredge':
        score = data.investoredge;
        break;
    }
  }

  return { score, loading, error, refetch };
}

export default useScoreData;
