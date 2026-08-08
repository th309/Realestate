"use client";

import { Zap } from "lucide-react";

/**
 * Free vs Pro tier badge used across the pricing feature-comparison cards.
 * Previously duplicated verbatim in FeatureShowcaseInsights and
 * FeatureShowcaseData; hoisted here so the two columns can never drift apart.
 */
export function TierBadge({ tier }: { tier: "free" | "pro" }) {
  if (tier === "free") {
    return (
      <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded">
        Free
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
      <Zap className="w-3 h-3" />
      Pro
    </span>
  );
}
