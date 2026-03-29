"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchAPI } from "@/lib/data";
import {
  normalizeConfidenceLevel,
  type ScoreType,
  type GeographyType,
  type AllScoresResponse,
  type UseScoreDataOptions,
  type UseScoreDataReturn,
  type ScoreBadgeData,
  type ScoreCardData,
  type ScoreTeaserData,
} from "./score-data.types";

// Re-export all types so existing imports continue to work
export type {
  ScoreType,
  GeographyType,
  ScoreAccess,
  TrendDirection,
  ConfidenceLevel,
  MetricDetail,
  ComponentDetail,
  ConfidenceInfo,
  HistoryPoint,
  ScoreHistory,
  UpgradeCta,
  ScoreBadgeData,
  ScoreCardData,
  ScoreTeaserData,
  AllScoresResponse,
  UseScoreDataOptions,
  UseScoreDataReturn,
} from "./score-data.types";

// Simple in-memory cache
const scoreCache = new Map<
  string,
  { data: AllScoresResponse; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(
  geographyType: GeographyType,
  geographyId: string,
  options: UseScoreDataOptions,
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

function getScoreLabel(type: ScoreType): string {
  if (type === "propertyiq") return "PropertyIQ";
  // Legacy labels for backward compat
  return type === "market_health"
    ? "Market Health"
    : type === "homeready"
      ? "HomeReady"
      : "InvestorEdge";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function transformScore(type: ScoreType, data: any, scoreDate: string): any {
  if (!data) {
    return {
      type,
      score: null,
      status: "unavailable",
      label: getScoreLabel(type),
      confidence: { level: "f", percentage: 0 },
    };
  }

  // Leave trendChange undefined when API didn't send it so UI shows "--" not "0.0 pts"
  const trendChange =
    data.trend_change != null ? Number(data.trend_change) : undefined;
  const trendDir: "up" | "down" | "stable" =
    trendChange != null
      ? trendChange > 0.01
        ? "up"
        : trendChange < -0.01
          ? "down"
          : "stable"
      : "stable";

  const out: any = {
    type,
    label: getScoreLabel(type),
    score: data.score != null ? Number(data.score) : null,
    grade: data.grade || "\u2014",
    trend: trendDir,
    trendChange,
    access: "full",
    status: "complete",
    periodDate: scoreDate,
    confidence: {
      level: normalizeConfidenceLevel(data.confidence_level),
      percentage: data.confidence != null ? Number(data.confidence) : 0,
      metricsAvailable: 0,
      metricsTotal: 0,
      freshnessInDays: 0,
    },
  };
  if (data.history && Array.isArray(data.history.data)) {
    out.history = {
      data: data.history.data,
      months: data.history.months ?? 0,
      trend: data.history.trend ?? trendDir,
      change: data.history.change ?? trendChange,
    };
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Hook to fetch PropertyIQ score data for a geography
 */
export function useScoreData(
  geographyType: GeographyType | null,
  geographyId: string | null,
  options: UseScoreDataOptions = {},
): UseScoreDataReturn {
  const {
    expanded = false,
    historyMonths = 0,
    historyYears = 0,
    includeOutcomes = false,
    userTier,
  } = options;

  const [data, setData] = useState<AllScoresResponse | null>(null);
  const [loading, setLoading] = useState(() =>
    Boolean(geographyType && geographyId),
  );
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
      if (expanded) params.append("expanded", "true");
      if (historyMonths > 0)
        params.append("historyMonths", historyMonths.toString());
      if (historyYears > 0)
        params.append("historyYears", historyYears.toString());
      if (includeOutcomes) params.append("includeOutcomes", "true");

      const queryString = params.toString();
      const endpoint = `/api/scores/${geographyType}/${encodeURIComponent(geographyId)}${queryString ? `?${queryString}` : ""}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawResult = await fetchAPI<any>(endpoint);

      if (!rawResult) {
        throw new Error("No data received from API");
      }

      const scoreDate = rawResult.score_date || "";

      const transformed: AllScoresResponse = {
        geographyId: rawResult.location_id || geographyId,
        geographyType: rawResult.geography || geographyType,
        geographyName: rawResult.location_name || "",
        periodDate: scoreDate,
        userTier: "pro",
        calculatedAt: new Date().toISOString(),
        calculationVersion: "1.0.0",
        // Primary unified score
        propertyiq: rawResult.scores?.propertyiq
          ? transformScore("propertyiq", rawResult.scores.propertyiq, scoreDate)
          : undefined,
        // Legacy score types for backward compatibility
        marketHealth: transformScore(
          "market_health",
          rawResult.scores?.markethealth || rawResult.scores?.market_health,
          scoreDate,
        ),
        homeready: transformScore(
          "homeready",
          rawResult.scores?.homeready,
          scoreDate,
        ),
        investoredge: transformScore(
          "investoredge",
          rawResult.scores?.investoredge,
          scoreDate,
        ),
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
        const message =
          err instanceof Error ? err.message : "Failed to fetch score data";
        setError(message);
        setData(null);
      }
    } finally {
      if (latestRequestRef.current === cacheKey) {
        setLoading(false);
      }
    }
  }, [
    geographyType,
    geographyId,
    expanded,
    historyMonths,
    historyYears,
    includeOutcomes,
    userTier,
  ]);

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

/** Hook to fetch a single score type for a geography. Thin wrapper around useScoreData. */
export function useSingleScore(
  geographyType: GeographyType | null,
  geographyId: string | null,
  scoreType: ScoreType,
  options: UseScoreDataOptions = {},
) {
  const { data, loading, error, refetch } = useScoreData(
    geographyType,
    geographyId,
    options,
  );
  const SCORE_KEY_MAP: Record<ScoreType, keyof AllScoresResponse> = {
    propertyiq: "propertyiq",
    market_health: "marketHealth",
    homeready: "homeready",
    investoredge: "investoredge",
  };
  const score = data ? (data[SCORE_KEY_MAP[scoreType]] ?? null) : null;
  return {
    score: score as ScoreBadgeData | ScoreCardData | ScoreTeaserData | null,
    loading,
    error,
    refetch,
  };
}

export default useScoreData;
