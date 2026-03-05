"use client";

/**
 * AmbientInsight Component
 *
 * Displays an AI-generated market insight for the selected geography.
 * Fetches from the insights API via useInsight hook.
 * Gated behind EntitlementGate — free users see the first sentence only.
 */

import { Sparkles } from "lucide-react";
import { useInsight } from "@/lib/data";
import { EntitlementGate } from "@/components/entitlements";
import type { GeoLevel } from "../../types";

interface AmbientInsightProps {
  geoLevel: GeoLevel;
  regionId: string | null;
}

/** Extract the first sentence from insight text */
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/);
  return match ? match[0] : text;
}

function InsightSkeleton() {
  return (
    <div className="space-y-1.5">
      <span className="inline-block h-3 w-full rounded bg-on-surface/10 animate-pulse" />
      <span className="inline-block h-3 w-3/4 rounded bg-on-surface/10 animate-pulse" />
    </div>
  );
}

function InsightContent({ text }: { text: string }) {
  return <p className="text-xs text-on-surface leading-relaxed">{text}</p>;
}

function InsightTeaser({ text }: { text: string }) {
  return (
    <div>
      <p className="text-xs text-on-surface leading-relaxed">
        {firstSentence(text)}
      </p>
      <p className="text-[10px] text-primary mt-1.5 font-medium">
        Upgrade to see full analysis
      </p>
    </div>
  );
}

export function AmbientInsight({ geoLevel, regionId }: AmbientInsightProps) {
  const { insight, loading } = useInsight(geoLevel, regionId);

  // Don't render anything if there's no insight and we're not loading
  if (!loading && !insight) return null;

  return (
    <div className="bg-surface-container-low rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
          AI Insight
        </span>
      </div>

      {loading ? (
        <InsightSkeleton />
      ) : insight ? (
        <EntitlementGate
          type="feature"
          id="ai_insights"
          fallback={<InsightTeaser text={insight} />}
          loadingFallback={<InsightSkeleton />}
        >
          <InsightContent text={insight} />
        </EntitlementGate>
      ) : null}
    </div>
  );
}
