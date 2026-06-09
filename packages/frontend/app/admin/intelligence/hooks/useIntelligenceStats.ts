/**
 * useIntelligenceStats Hook
 *
 * Fetches system health stats from the market intelligence admin endpoint.
 * Returns briefing coverage, news volume, rankings freshness, and briefing status.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAPIRaw } from "@/lib/data";

export interface IntelligenceStats {
  total_briefings: number;
  metros_covered: number;
  counties_covered: number;
  oldest_briefing_days: number | null;
  news_articles_last_7d: number;
  rankings_last_refresh: string | null;
  briefings_available: boolean;
}

interface UseIntelligenceStatsReturn {
  stats: IntelligenceStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useIntelligenceStats(): UseIntelligenceStatsReturn {
  const [stats, setStats] = useState<IntelligenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAPIRaw("/api/admin/intelligence/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: IntelligenceStats = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
