'use client';

import { useState, useEffect } from 'react';
import { fetchScore } from '@/lib/data';

export interface MyMarket {
  id: string;
  name: string;
  type: 'metro' | 'county' | 'zip';
  state?: string;
  score: number | null;
  trend?: 'up' | 'down' | 'stable';
  lastViewed?: string;
  isPinned?: boolean;
}

interface UseMyMarketsOptions {
  userType?: 'homebuyer' | 'investor';
  maxMarkets?: number;
}

/**
 * Hook to fetch user's saved/recent markets with scores
 * Sources: pinned favorites, recent reports, recent searches
 */
export function useMyMarkets(options: UseMyMarketsOptions = {}) {
  const { userType = 'homebuyer', maxMarkets = 5 } = options;

  const [markets, setMarkets] = useState<MyMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scoreType = userType === 'investor' ? 'investoredge' : 'homeready';

  useEffect(() => {
    async function loadMarkets() {
      try {
        setLoading(true);
        setError(null);

        // Get markets from multiple sources
        const storedMarkets = getStoredMarkets();
        const recentMarkets = getRecentMarkets();

        // Combine and dedupe
        const allMarkets = [...storedMarkets];
        for (const market of recentMarkets) {
          if (!allMarkets.find(m => m.id === market.id)) {
            allMarkets.push(market);
          }
        }

        // Limit and sort (pinned first, then by lastViewed)
        const sortedMarkets = allMarkets
          .sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const aTime = a.lastViewed ? new Date(a.lastViewed).getTime() : 0;
            const bTime = b.lastViewed ? new Date(b.lastViewed).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, maxMarkets);

        // Fetch scores for each market
        const marketsWithScores = await Promise.all(
          sortedMarkets.map(async (market) => {
            try {
              const scoreData = await fetchScore(market.type, market.id);
              const scoreValue = scoreData?.scores?.[scoreType]?.score ?? null;
              return {
                ...market,
                score: scoreValue,
                // Trend could be computed from historical data; for now, leave undefined
                trend: undefined,
              };
            } catch {
              return { ...market, score: null };
            }
          })
        );

        setMarkets(marketsWithScores);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load markets');
      } finally {
        setLoading(false);
      }
    }

    loadMarkets();
  }, [scoreType, maxMarkets]);

  // Add a market to the list
  const addMarket = (market: Omit<MyMarket, 'score'>) => {
    setMarkets(prev => {
      if (prev.find(m => m.id === market.id)) return prev;
      const newMarket: MyMarket = { ...market, score: null, lastViewed: new Date().toISOString() };
      const updated = [newMarket, ...prev].slice(0, maxMarkets);
      saveRecentMarket(newMarket);
      return updated;
    });
  };

  // Remove a market from the list
  const removeMarket = (marketId: string) => {
    setMarkets(prev => prev.filter(m => m.id !== marketId));
  };

  // Toggle pinned status
  const togglePin = (marketId: string) => {
    setMarkets(prev => prev.map(m =>
      m.id === marketId ? { ...m, isPinned: !m.isPinned } : m
    ));
    // TODO: Persist to user profile/localStorage
  };

  // Refresh scores
  const refreshScores = async () => {
    setLoading(true);
    const updated = await Promise.all(
      markets.map(async (market) => {
        try {
          const scoreData = await fetchScore(market.type, market.id);
          const scoreValue = scoreData?.scores?.[scoreType]?.score ?? null;
          return { ...market, score: scoreValue };
        } catch {
          return market;
        }
      })
    );
    setMarkets(updated);
    setLoading(false);
  };

  return {
    markets,
    loading,
    error,
    addMarket,
    removeMarket,
    togglePin,
    refreshScores,
  };
}

// Helper: Get pinned/favorite markets from localStorage
function getStoredMarkets(): MyMarket[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('propertyiq_pinned_markets');
    if (!stored) return [];
    return JSON.parse(stored) as MyMarket[];
  } catch {
    return [];
  }
}

// Helper: Get recent markets from localStorage, falling back to geography history
function getRecentMarkets(): MyMarket[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('propertyiq_recent_markets');
    if (stored) {
      const parsed = JSON.parse(stored) as MyMarket[];
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // fall through
  }

  // Fallback: last geography the user viewed on the maps page
  try {
    const lastGeo = localStorage.getItem('propertyiq-last-geography');
    if (lastGeo) {
      const geo = JSON.parse(lastGeo);
      if (geo?.id && geo?.name && ['metro', 'county', 'zip'].includes(geo.type)) {
        return [{
          id: geo.id,
          name: geo.name,
          type: geo.type as 'metro' | 'county' | 'zip',
          state: geo.state,
          score: null,
          lastViewed: new Date().toISOString(),
        }];
      }
    }
  } catch {
    // fall through
  }

  return [];
}

// Helper: Save recent market to localStorage
function saveRecentMarket(market: MyMarket) {
  if (typeof window === 'undefined') return;

  try {
    const existing = getRecentMarkets();
    const updated = [market, ...existing.filter(m => m.id !== market.id)].slice(0, 10);
    localStorage.setItem('propertyiq_recent_markets', JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}


export default useMyMarkets;
