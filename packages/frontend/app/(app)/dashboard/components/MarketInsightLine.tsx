"use client";

/**
 * MarketInsightLine
 *
 * Renders a single line of AI-generated insight text for a market row.
 * Isolated as its own component so that useInsight can be called per-row
 * without violating the rules of hooks (no hooks in loops).
 */

import { useInsight } from "@/lib/data";

interface MarketInsightLineProps {
  regionId: string;
  archetypeId: string | null;
}

export function MarketInsightLine({
  regionId,
  archetypeId,
}: MarketInsightLineProps) {
  const { insight, loading } = useInsight(
    "metro",
    regionId,
    "archetype_match",
    archetypeId ?? undefined,
  );

  if (loading) {
    return (
      <div className="h-3 w-48 bg-surface-container-highest rounded mt-1 animate-pulse" />
    );
  }

  if (!insight) return null;

  return (
    <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
      {insight}
    </p>
  );
}
