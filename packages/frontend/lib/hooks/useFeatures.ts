'use client';

/**
 * useFeatures Hook
 *
 * Fetches and caches user features for feature gating.
 * Provides helper methods to check feature access and limits.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export interface UserFeature {
  slug: string;
  name: string;
  category: string;
  value_type: string;
  value: unknown;
  source: 'override' | 'grandfather' | 'tier' | 'default';
  is_grandfathered: boolean;
  expires_at?: string;
}

export interface ResolvedFeatures {
  tier: string;
  features: Record<string, unknown>;
  limits: Record<string, number>;
  detailed: UserFeature[];
}

interface UseFeaturesOptions {
  userId?: string;
  tierSlug?: string;
  autoLoad?: boolean;
}

interface UseFeaturesReturn {
  features: ResolvedFeatures | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  
  // Helper methods
  isEnabled: (featureSlug: string) => boolean;
  getLimit: (featureSlug: string) => number;
  isUnlimited: (featureSlug: string) => boolean;
  getValue: <T = unknown>(featureSlug: string, defaultValue?: T) => T;
  getFeature: (featureSlug: string) => UserFeature | undefined;
  
  // Specific feature checks
  hasAnalyticsAccess: boolean;
  canSaveQueries: boolean;
  canUseWatchlist: boolean;
  canExportCsv: boolean;
  queriesPerDay: number;
  savedQueriesLimit: number;
  watchlistLimit: number;
}

// In-memory cache for features
const featuresCache = new Map<string, { data: ResolvedFeatures; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useFeatures({
  userId,
  tierSlug,
  autoLoad = true,
}: UseFeaturesOptions = {}): UseFeaturesReturn {
  const [features, setFeatures] = useState<ResolvedFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(() => `${userId || 'anon'}-${tierSlug || 'default'}`, [userId, tierSlug]);

  const refresh = useCallback(async () => {
    // Check cache first
    const cached = featuresCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setFeatures(cached.data);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let url = '/api/features';
      const params = new URLSearchParams();
      
      if (userId) params.set('userId', userId);
      if (tierSlug) params.set('tier', tierSlug);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setFeatures(data.data);
        featuresCache.set(cacheKey, { data: data.data, timestamp: Date.now() });
      } else {
        setError(data.error || 'Failed to load features');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, userId, tierSlug]);

  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad, refresh]);

  // Helper methods
  const isEnabled = useCallback(
    (featureSlug: string): boolean => {
      if (!features) return false;
      const value = features.features[featureSlug];
      return value === true || value === 'true';
    },
    [features]
  );

  const getLimit = useCallback(
    (featureSlug: string): number => {
      if (!features) return 0;
      return features.limits[featureSlug] ?? 0;
    },
    [features]
  );

  const isUnlimited = useCallback(
    (featureSlug: string): boolean => {
      return getLimit(featureSlug) === -1;
    },
    [getLimit]
  );

  const getValue = useCallback(
    <T = unknown>(featureSlug: string, defaultValue?: T): T => {
      if (!features) return defaultValue as T;
      return (features.features[featureSlug] as T) ?? (defaultValue as T);
    },
    [features]
  );

  const getFeature = useCallback(
    (featureSlug: string): UserFeature | undefined => {
      return features?.detailed.find((f) => f.slug === featureSlug);
    },
    [features]
  );

  // Computed feature checks
  const hasAnalyticsAccess = useMemo(
    () => isEnabled('analytics_assistant_enabled'),
    [isEnabled]
  );

  const canSaveQueries = useMemo(
    () => isEnabled('saved_queries_enabled'),
    [isEnabled]
  );

  const canUseWatchlist = useMemo(
    () => isEnabled('watchlist_enabled'),
    [isEnabled]
  );

  const canExportCsv = useMemo(
    () => isEnabled('export_csv_enabled'),
    [isEnabled]
  );

  const queriesPerDay = useMemo(
    () => getLimit('analytics_queries_per_day'),
    [getLimit]
  );

  const savedQueriesLimit = useMemo(
    () => getLimit('saved_queries_limit'),
    [getLimit]
  );

  const watchlistLimit = useMemo(
    () => getLimit('watchlist_limit'),
    [getLimit]
  );

  return {
    features,
    isLoading,
    error,
    refresh,
    isEnabled,
    getLimit,
    isUnlimited,
    getValue,
    getFeature,
    hasAnalyticsAccess,
    canSaveQueries,
    canUseWatchlist,
    canExportCsv,
    queriesPerDay,
    savedQueriesLimit,
    watchlistLimit,
  };
}

/**
 * Clear the features cache (useful after tier changes)
 */
export function clearFeaturesCache(): void {
  featuresCache.clear();
}
