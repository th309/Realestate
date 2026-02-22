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
import { fetchAPI } from '@/lib/data';

export type ScoreType = 'market_health' | 'homeready' | 'investoredge';
export type GeographyType = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip' | 'tract';
export type ScoreAccess = 'full' | 'teaser';
export type TrendDirection = 'up' | 'down' | 'stable';
export type ConfidenceLevel = 'a' | 'b' | 'c' | 'f';

/**
 * Normalize confidence level from backend to lowercase letter grade.
 * Handles both new format (A/B/C/F) and legacy format (HIGH/MEDIUM/LOW/INSUFFICIENT)
 * for backward compatibility with existing DB rows until scores are recalculated.
 */
const LEGACY_CONFIDENCE_MAP: Record<string, ConfidenceLevel> = {
  high: 'a',
  medium: 'b',
  low: 'c',
  insufficient: 'f',
};

function normalizeConfidenceLevel(raw: string | null | undefined): ConfidenceLevel {
  if (!raw) return 'b';
  const lower = raw.toLowerCase();
  // New format: already a/b/c/f
  if (lower === 'a' || lower === 'b' || lower === 'c' || lower === 'f') return lower;
  // Legacy format: high/medium/low/insufficient
  return LEGACY_CONFIDENCE_MAP[lower] ?? 'b';
}

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
  /** 3-month change in points; undefined when backend has no history (single score_date) */
  trendChange?: number;
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
  /** 0-6; omit for latest scores only. Pass only when you need trend/history (e.g. 3-month change). */
  historyMonths?: number;
  /** 3 or 5; for extended history with outcomes validation. */
  historyYears?: number;
  /** true to include actual returns and benchmark comparisons. */
  includeOutcomes?: boolean;
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
  const { expanded = false, historyMonths = 0, historyYears = 0, includeOutcomes = false, userTier } = options;

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
      if (historyYears > 0) params.append('historyYears', historyYears.toString());
      if (includeOutcomes) params.append('includeOutcomes', 'true');

      const queryString = params.toString();
      const endpoint = `/api/scores/${geographyType}/${encodeURIComponent(geographyId)}${queryString ? `?${queryString}` : ''}`;

      // Use the standard fetchAPI helper from client.ts
      const rawResult = await fetchAPI<any>(endpoint);

      if (!rawResult) {
        throw new Error('No data received from API');
      }

      // Transform backend ScoreResult into AllScoresResponse shape
      // Backend (scoring.service.ts) returns keys: homeready, investoredge, markethealth
      // When historyMonths is requested (up to 6), backend returns trend_change and history for real-time calculations.
      const transformScore = (type: ScoreType, data: any): any => {
        if (!data) return {
          type,
          score: null,
          status: 'unavailable',
          label: type === 'market_health' ? 'Market Health' : type === 'homeready' ? 'HomeReady' : 'InvestorEdge',
          confidence: { level: 'f', percentage: 0 }
        };

        // Leave trendChange undefined when API didn't send it (e.g. only one score_date in DB) so UI shows "--" not "0.0 pts"
        const trendChange = data.trend_change != null ? Number(data.trend_change) : undefined;
        const trendDir: 'up' | 'down' | 'stable' =
          trendChange != null
            ? trendChange > 0.01
              ? 'up'
              : trendChange < -0.01
                ? 'down'
                : 'stable'
            : 'stable';

        const out: any = {
          type,
          label: type === 'market_health' ? 'Market Health' : type === 'homeready' ? 'HomeReady' : 'InvestorEdge',
          score: data.score != null ? Number(data.score) : null,
          grade: data.grade || '\u2014',
          trend: trendDir,
          trendChange,
          access: 'full',
          status: 'complete',
          periodDate: rawResult.score_date || '',
          confidence: {
            level: normalizeConfidenceLevel(data.confidence_level),
            percentage: data.confidence != null ? Number(data.confidence) : 0,
            metricsAvailable: 0,
            metricsTotal: 0,
            freshnessInDays: 0
          }
        };
        if (data.history && Array.isArray(data.history.data)) {
          out.history = {
            data: data.history.data,
            months: data.history.months ?? 0,
            trend: data.history.trend ?? trendDir,
            change: data.history.change ?? trendChange
          };
        }
        return out;
      };

      const transformed: AllScoresResponse = {
        geographyId: rawResult.location_id || geographyId,
        geographyType: rawResult.geography || geographyType,
        geographyName: rawResult.location_name || '',
        periodDate: rawResult.score_date || '',
        userTier: 'pro',
        calculatedAt: new Date().toISOString(),
        calculationVersion: '1.0.0',
        // Backend keys are all lowercase: homeready, investoredge, markethealth
        marketHealth: transformScore('market_health', rawResult.scores?.markethealth || rawResult.scores?.market_health),
        homeready: transformScore('homeready', rawResult.scores?.homeready),
        investoredge: transformScore('investoredge', rawResult.scores?.investoredge),
      };

      // Only update if this is still the latest request
      if (latestRequestRef.current === cacheKey) {
        setCachedData(cacheKey, transformed);
        setData(transformed);
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
  }, [geographyType, geographyId, expanded, historyMonths, historyYears, includeOutcomes, userTier]);

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
