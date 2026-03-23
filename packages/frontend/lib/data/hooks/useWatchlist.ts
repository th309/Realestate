"use client";

/**
 * USE WATCHLIST HOOK
 *
 * React Query hook for fetching the user's geography watchlist.
 * Only fetches when the user is authenticated.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchWatchlist, type WatchlistItem } from "../fetchers/watchlist";
import { useAuth } from "@/lib/auth";

const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export function useWatchlist() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: fetchWatchlist,
    enabled: !!user,
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
  });

  return {
    favorites: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
