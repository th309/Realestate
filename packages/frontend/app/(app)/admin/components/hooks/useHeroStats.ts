"use client";

/**
 * USE HERO STATS HOOK
 *
 * Fetches the top-level KPI stats for the admin command center hero row.
 * Accepts a refreshTrigger to force a refetch when the dashboard refreshes.
 *
 * The backend returns { success, data } where data matches the HeroStats
 * shape defined in admin-metrics.types.ts on the backend.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data";

export interface HeroStats {
  system_health: { uptime_pct: number; sparkline: number[] };
  active_alerts: {
    count: number;
    critical: number;
    warning: number;
    sparkline: number[];
  };
  data_freshness: { fresh: number; total: number; sparkline: number[] };
  total_users: {
    count: number;
    new_this_week: number;
    sparkline: number[];
  };
  score_health: { hit_rate_1y: number; sparkline: number[] };
}

/** Backend envelope: all admin endpoints wrap data in { success, data }. */
interface HeroStatsResponse {
  success: boolean;
  data: HeroStats;
}

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

export function useHeroStats(refreshTrigger: number) {
  const { data, isLoading, error, refetch } = useQuery<HeroStats>({
    queryKey: ["admin", "hero-stats", refreshTrigger],
    queryFn: async () => {
      const response = await fetchAPI<HeroStatsResponse>(
        "/api/admin/metrics/hero-stats",
      );
      return response.data;
    },
    staleTime: STALE_TIME,
    gcTime: STALE_TIME * 5,
  });

  return {
    stats: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
