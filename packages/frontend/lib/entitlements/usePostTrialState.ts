"use client";

import { useEntitlements } from "./EntitlementsContext";
import { useQuery } from "@tanstack/react-query";
import { fetchOnboardingState } from "@/lib/data";

export interface PostTrialState {
  /** User had a trial that has expired and didn't convert */
  isPostTrial: boolean;
  /** Features the user actually used during trial */
  usedFeatures: {
    reports: boolean;
    markets: boolean;
    scores: boolean;
  };
  /** Usage summary strings for each feature */
  usageSummaries: {
    reports: string | null;
    markets: string | null;
    scores: string | null;
  };
}

export function usePostTrialState(): PostTrialState {
  const { tier, trial } = useEntitlements();

  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    staleTime: Infinity,
  });

  const stats = onboardingState?.usage_stats;

  // Post-trial = free tier, no active trial, but has usage history (had a trial)
  const isPostTrial =
    tier === "free" &&
    !trial?.active &&
    stats != null &&
    (stats.markets_viewed > 0 ||
      stats.scores_checked > 0 ||
      stats.reports_generated > 0);

  const usedFeatures = {
    reports: (stats?.reports_generated ?? 0) > 0,
    markets: (stats?.markets_viewed ?? 0) > 0,
    scores: (stats?.scores_checked ?? 0) > 0,
  };

  const usageSummaries = {
    reports: usedFeatures.reports
      ? `You generated ${stats!.reports_generated} report${stats!.reports_generated > 1 ? "s" : ""} during your trial`
      : null,
    markets: usedFeatures.markets
      ? `You analyzed ${stats!.markets_viewed} market${stats!.markets_viewed > 1 ? "s" : ""} during your trial`
      : null,
    scores: usedFeatures.scores
      ? `You viewed ${stats!.scores_checked} score${stats!.scores_checked > 1 ? "s" : ""} during your trial`
      : null,
  };

  return { isPostTrial, usedFeatures, usageSummaries };
}
