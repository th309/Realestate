/**
 * PurposeTallySidebar
 *
 * Lists per-purpose reviewer preference counts (primary vs shadow vs tie)
 * for the AI Shadow Mode review page. Clicking a row filters the pairs
 * list to that purpose; clicking "All purposes" clears the filter.
 *
 * Material Design 3 compliant.
 */

"use client";

import { useShadowTally } from "@/lib/data/fetchers/ai-shadow";

export function PurposeTallySidebar({
  selectedPurpose,
  onSelect,
}: {
  selectedPurpose?: string;
  onSelect: (purpose: string | undefined) => void;
}) {
  const { data: tallies, isLoading } = useShadowTally();

  if (isLoading) {
    return (
      <aside className="text-sm text-on-surface-variant">
        Loading tallies…
      </aside>
    );
  }
  if (!tallies || tallies.length === 0) {
    return (
      <aside className="text-sm text-on-surface-variant">
        No shadow data yet.
      </aside>
    );
  }

  return (
    <aside className="space-y-3">
      <button
        onClick={() => onSelect(undefined)}
        className={`w-full rounded-lg p-3 text-left text-sm ${
          !selectedPurpose
            ? "bg-primary-container"
            : "hover:bg-surface-container"
        }`}
      >
        All purposes
      </button>

      {tallies.map((t) => {
        const total = t.primary + t.shadow + t.tie;
        const costRatio =
          t.avgPrimaryCost > 0 && t.avgShadowCost > 0
            ? (t.avgPrimaryCost / t.avgShadowCost).toFixed(1)
            : null;

        return (
          <button
            key={t.purpose}
            onClick={() => onSelect(t.purpose)}
            className={`w-full rounded-lg p-3 text-left text-sm ${
              selectedPurpose === t.purpose
                ? "bg-primary-container"
                : "hover:bg-surface-container"
            }`}
          >
            <div className="font-mono text-xs font-semibold">{t.purpose}</div>
            <div className="mt-1 text-xs text-on-surface-variant">
              Primary: {t.primary} · Shadow: {t.shadow} · Tie: {t.tie} (n=
              {total})
            </div>
            <div className="text-xs text-on-surface-variant">
              Unreviewed: {t.unreviewed}
              {costRatio && ` · Shadow ${costRatio}× cheaper`}
            </div>
          </button>
        );
      })}
    </aside>
  );
}
