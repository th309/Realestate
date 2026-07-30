"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchVisitorList,
  type VisitorListOptions,
} from "../fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  VisitorListResult,
} from "../fetchers/admin-analytics.types";

/**
 * The visitor list behind /admin/analytics → Visitors.
 *
 * Owns its query key, like useOverviewAnalytics, so every consumer resolves
 * from one cache entry rather than each component inventing a key and quietly
 * refetching the same endpoint.
 *
 * `filters` is part of the key, and `filters.traffic` decides which population
 * the list describes — so switching segments refetches instead of re-showing
 * the previous segment's visitors under a new label.
 */
export function visitorListQueryKey(
  days: number,
  filters: AnalyticsFilters,
  options: VisitorListOptions,
) {
  return ["analytics", "visitors", days, filters, options] as const;
}

export function useVisitorList(
  days: number,
  filters: AnalyticsFilters = {},
  options: VisitorListOptions = {},
) {
  return useQuery<VisitorListResult>({
    queryKey: visitorListQueryKey(days, filters, options),
    queryFn: () => fetchVisitorList(days, filters, options),
    staleTime: 5 * 60 * 1000,
  });
}
