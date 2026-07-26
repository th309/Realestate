"use client";
/**
 * Posts that failed to publish. Shared by the home ticker (which counts them)
 * and the needs-attention card (which lists them) — one query key, so both read
 * the same cache and a retry or skip updates them together.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "./posts-api";
import { POSTS_FAILED_KEY } from "./use-post-mutations";

/** Enough to triage; the card shows the first few and counts the rest. */
const FAILED_POST_LIMIT = 50;

export function useFailedPosts() {
  return useQuery({
    queryKey: POSTS_FAILED_KEY,
    queryFn: () => fetchPosts({ status: "failed", limit: FAILED_POST_LIMIT }),
    refetchInterval: 60_000,
  });
}
