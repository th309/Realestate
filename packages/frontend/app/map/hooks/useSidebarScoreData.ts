"use client";

import { useMemo } from "react";
import { useEntitlements } from "@/lib/entitlements";

/**
 * Maps the raw PropertyIQ score response into the shape the sidebar score card
 * expects, applying entitlement gating (score value/trend hidden, breakdown
 * downgraded to a teaser) without any hardcoded tier checks.
 *
 * `scoreResponse` is the `data` from `useScoreData`; it is loosely typed here
 * because the original inline implementation relied on the same runtime casts.
 */
 
export function useSidebarScoreData(
  scoreResponse: any,
  scoresLoading: boolean,
) {
  const { getAccess, loading: entitlementsLoading } = useEntitlements();

  return useMemo(() => {
    if (scoresLoading) {
      return { isLoading: true };
    }

    if (!scoreResponse) return undefined;

    const isBreakdownGated =
      !entitlementsLoading &&
      getAccess("feature", "score_breakdown").level === "none";

    const scoreObj = scoreResponse.propertyiq;
    if (!scoreObj || typeof scoreObj !== "object" || !("score" in scoreObj)) {
      return { isLoading: false };
    }

    const scoreMetricAccess = getAccess("metric", "propertyiq_score");
    const gated = !entitlementsLoading && scoreMetricAccess.level === "none";

    return {
      propertyiq: {
        score: gated ? undefined : (scoreObj.score ?? undefined),
        trend: gated
          ? undefined
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((scoreObj as any).trendChange ?? undefined),
        access: (isBreakdownGated ? "teaser" : "full") as "full" | "teaser",
        gated,
        tierRequired: gated ? scoreMetricAccess.tierRequired : undefined,
      },
      isLoading: false,
    };
  }, [scoreResponse, scoresLoading, entitlementsLoading, getAccess]);
}
