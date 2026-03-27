"use client";

/**
 * USE HERO STATS HOOK
 *
 * Fetches the top-level KPI stats for the admin command center hero row.
 * Accepts a refreshTrigger to force a refetch when the dashboard refreshes.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/data";

export interface HeroStats {
  totalUsers: number;
  activeUsers30d: number;
  totalReports: number;
  reportsLast7d: number;
  apiRequestsToday: number;
  errorRate: number;
  avgResponseTimeMs: number;
  revenueThisMonth: number;
}

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

export function useHeroStats(refreshTrigger: number) {
  const { data, isLoading, error, refetch } = useQuery<HeroStats>({
    queryKey: ["admin", "hero-stats", refreshTrigger],
    queryFn: () => fetchAPI<HeroStats>("/api/admin/metrics/hero-stats"),
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
