"use client";

import { useInsight } from "@/lib/data/hooks/useInsight";

/**
 * The hero card's market narrative. Fetches the AI-generated, news-aware,
 * predictive `market_outlook` insight client-side (React Query, cached) so the
 * hero stays a static LCP element — the server-rendered `fallback` (a templated
 * predictive line) shows immediately and upgrades to the AI copy when it loads.
 */
export function OutlookNarrative({
  cbsa,
  fallback,
  className = "",
}: {
  cbsa: string;
  fallback: string;
  className?: string;
}) {
  const { insight } = useInsight("metro", cbsa, "market_outlook");
  return <p className={className}>{insight?.trim() || fallback}</p>;
}
