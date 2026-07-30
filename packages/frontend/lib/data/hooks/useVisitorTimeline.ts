"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchVisitorTimeline } from "../fetchers/admin-analytics";
import type { VisitorTimeline } from "../fetchers/admin-analytics.types";

/**
 * One visitor's full journey, for the master/detail panel.
 *
 * Owns its query key so re-selecting a visitor you already opened resolves from
 * cache instead of re-fetching a 500-row timeline.
 */
export function visitorTimelineQueryKey(
  visitorId: string | null,
  limit?: number,
) {
  return ["analytics", "visitor-timeline", visitorId, limit ?? null] as const;
}

/**
 * `visitorId` is nullable because the panel renders before anything is
 * selected. The query stays disabled until there is an id, so an empty
 * master/detail view issues no request rather than firing at `/visitors/`.
 */
export function useVisitorTimeline(visitorId: string | null, limit?: number) {
  return useQuery<VisitorTimeline>({
    queryKey: visitorTimelineQueryKey(visitorId, limit),
    queryFn: () => fetchVisitorTimeline(visitorId as string, limit),
    enabled: Boolean(visitorId),
    staleTime: 5 * 60 * 1000,
  });
}
