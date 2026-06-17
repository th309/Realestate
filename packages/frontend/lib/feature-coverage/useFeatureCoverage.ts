"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOnboardingState, fetchUsageCoverage } from "@/lib/data";
import type { Persona } from "@/lib/data";
import { deriveCoverage, type Coverage } from "./feature-coverage";

/**
 * Joins the server coverage read with onboarding state into the pure
 * `deriveCoverage` signal. Shares the `["onboarding-state"]` query with the
 * dashboard page (React Query dedupes by key). Returns null until both land.
 */
export function useFeatureCoverage(persona: Persona | null): Coverage | null {
  const onboarding = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    staleTime: 1000 * 60 * 60 * 2,
  });
  const coverage = useQuery({
    queryKey: ["usage-coverage"],
    queryFn: fetchUsageCoverage,
    staleTime: 1000 * 60 * 10,
  });

  if (!coverage.data || !onboarding.data) return null;

  return deriveCoverage({
    persona,
    usedFeatures: coverage.data.usedFeatures,
    mcpConnected: coverage.data.mcpConnected,
    checklist: onboarding.data.onboarding_checklist ?? [],
    usageStats: onboarding.data.usage_stats ?? null,
  });
}
