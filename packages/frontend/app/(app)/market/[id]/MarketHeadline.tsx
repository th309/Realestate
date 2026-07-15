"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { fetchMarketHeadline, type MarketSnapshotCard } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  buildHeadlineSummary,
  type HeadlineSummary,
} from "./market-headline-summary";

interface MarketHeadlineProps {
  geoType: string;
  geoId: string;
  marketName: string;
  view: "homebuyer" | "investor";
  cards: Record<string, MarketSnapshotCard>;
  score: number | null;
  scoreGrade: string;
}

export function MarketHeadline({
  geoType,
  geoId,
  marketName,
  view,
  cards,
  score,
  scoreGrade,
}: MarketHeadlineProps) {
  const { canAccess } = useEntitlements();
  const aiEnabled = canAccess("feature", "ai_insights");

  const fallback = buildHeadlineSummary(marketName, score, cards);
  const [content, setContent] = useState<HeadlineSummary>(fallback);
  const [loading, setLoading] = useState(false);

  // Fetch the AI headline once per (geoId, view) when entitled. On any failure
  // we keep the deterministic fallback already in state.
  const fetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!aiEnabled) {
      setContent(buildHeadlineSummary(marketName, score, cards));
      return;
    }
    const key = `${geoId}:${view}`;
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;

    const compactMetrics: Record<
      string,
      { value: number | null; formatted: string; change: number | null }
    > = {};
    for (const [id, card] of Object.entries(cards)) {
      if (card.value != null) {
        compactMetrics[id] = {
          value: card.value,
          formatted: card.formattedValue,
          change: card.percentChange,
        };
      }
    }

    setLoading(true);
    fetchMarketHeadline(geoType, geoId, {
      geoName: marketName,
      audience: view,
      metrics: compactMetrics,
      scores: {
        propertyiq: score != null ? { score, grade: scoreGrade } : null,
      },
    })
      .then((result) =>
        setContent({ headline: result.headline, summary: result.summary }),
      )
      .catch(() => (fetchedRef.current = null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoId, view, aiEnabled]);

  return (
    <motion.div
      className="bg-gradient-to-br from-primary/5 via-surface-container to-tertiary/5 rounded-2xl border border-primary/20 p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/15">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          {aiEnabled ? "PropertyIQ Take" : "Market Overview"}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton variant="text" width={280} height={24} />
          <Skeleton variant="text" width="100%" height={16} />
          <Skeleton variant="text" width="90%" height={16} />
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-on-surface mb-2">
            {content.headline}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {content.summary}
          </p>
        </>
      )}
    </motion.div>
  );
}

export default MarketHeadline;
