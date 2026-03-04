"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOnboardingState,
  completeOnboarding,
  resetOnboarding,
  saveOnboardingPreferences,
} from "@/lib/data";
import type { OnboardingState } from "@/lib/data";

const ONBOARDING_QUERY_KEY = ["onboarding-state"];

export function useTourState() {
  const queryClient = useQueryClient();

  const { data: onboardingState, isLoading } = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetchOnboardingState,
    staleTime: Infinity,
  });

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onMutate: () => {
      // Optimistically update cache to prevent re-triggering
      queryClient.setQueryData(
        ONBOARDING_QUERY_KEY,
        (old: OnboardingState | null | undefined) =>
          old
            ? { ...old, onboarding_completed_at: new Date().toISOString() }
            : old,
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });

  const resetMutation = useMutation({
    mutationFn: resetOnboarding,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });

  const savePreferencesMutation = useMutation({
    mutationFn: saveOnboardingPreferences,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });

  const shouldShowTour =
    !isLoading &&
    onboardingState !== null &&
    onboardingState.onboarding_completed_at === null;

  return {
    onboardingState,
    isLoading,
    shouldShowTour,
    markComplete: completeMutation.mutate,
    resetTour: resetMutation.mutate,
    savePreferences: savePreferencesMutation.mutate,
  };
}
