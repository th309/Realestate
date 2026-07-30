"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOverviewAnalytics } from "../fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  OverviewData,
} from "../fetchers/admin-analytics.types";

/**
 * Overview analytics for /admin/analytics.
 *
 * Owns the query key so every consumer shares one cache entry. Both the page
 * shell (which needs `trafficSegments` for the scope disclosure) and
 * OverviewTab (which needs the whole payload) call this; with the key defined
 * in one place they dedupe to a single request. Duplicating the key inline
 * meant any drift between the two silently became two fetches of the same
 * expensive endpoint.
 *
 * The key includes `filters`, and `filters.traffic` decides which population
 * every number describes — so switching segments correctly refetches rather
 * than reusing the previous segment's numbers.
 */
export function overviewAnalyticsQueryKey(
  days: number,
  filters: AnalyticsFilters,
) {
  return ["analytics", "overview", days, filters] as const;
}

export function useOverviewAnalytics(
  days: number,
  filters: AnalyticsFilters = {},
) {
  return useQuery<OverviewData>({
    queryKey: overviewAnalyticsQueryKey(days, filters),
    queryFn: () => fetchOverviewAnalytics(days, filters),
    staleTime: 5 * 60 * 1000,
  });
}
