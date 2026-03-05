"use client";

/**
 * USE PREFERENCES HOOK
 *
 * React Query hook for fetching and mutating user quiz preferences.
 * Provides cached read access and an optimistic mutation for upserts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPreferences,
  upsertPreferences,
  type UserPreferences,
  type UpsertPreferencesPayload,
} from "../fetchers/preferences";

const QUERY_KEY = ["user-preferences"] as const;
const CACHE_TIME = 1000 * 60 * 60 * 2; // 2 hours

export interface UsePreferencesResult {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: Error | null;
  savePreferences: (
    payload: UpsertPreferencesPayload,
  ) => Promise<UserPreferences>;
  isSaving: boolean;
}

export function usePreferences(): UsePreferencesResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<UserPreferences | null>({
    queryKey: QUERY_KEY,
    queryFn: fetchPreferences,
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
  });

  const mutation = useMutation({
    mutationFn: upsertPreferences,
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
    },
  });

  return {
    preferences: data ?? null,
    isLoading,
    error: error as Error | null,
    savePreferences: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
