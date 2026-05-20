"use client";

/**
 * Per-section AI insights for the analyzer page. ONE batched call to
 * `/api/analyzer/ai-insights/batch` returns all six section annotations in a
 * single LLM round-trip; the result is distributed into the same
 * `{ aiText, aiIsLoading, aiIsStale, onRefreshAi }` shape per section so
 * consumers don't change.
 *
 * Replaces the previous pattern of six concurrent per-section requests, which
 * fanned out to six Anthropic API calls and tripped upstream rate limits on
 * every analyzer page load (1-2 of the 6 would 429 and the corresponding
 * section narrative would silently disappear).
 *
 * Cache stale-detection: backend returns `cacheHit: true` on each section
 * when the parent batched response came from Redis (24h TTL). We flag those
 * as `isStale` so the UI shows a subtle refresh affordance.
 */
import { useCallback } from "react";
import type {
  BrrrrResult,
  DealGradingResult,
  DealInput,
  FlipResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import {
  fetchBatchedAiInsights,
  type AiInsightPayload,
  type AIAnnotationBatch,
} from "@/lib/data";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvestorGoal } from "./goal-types";

export interface UseSectionAiInsightsArgs {
  enabled: boolean;
  input: DealInput;
  rental: RentalResult | null | undefined;
  flip: FlipResult | null | undefined;
  brrrr: BrrrrResult | null | undefined;
  rentcast: unknown;
  piq: unknown;
  grading: DealGradingResult | null | undefined;
  strategy: "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR" | null;
  piqByGeo: {
    zip: number | null;
    county: number | null;
    metro: number | null;
  };
  goal?: InvestorGoal | null;
}

export interface SectionAiProps {
  aiText: string | null;
  aiIsLoading: boolean;
  aiIsStale: boolean;
  onRefreshAi: () => void;
}

const BATCHED_SECTION_IDS = [
  "recommendation_analysis",
  "projection",
  "expense_waterfall",
  "sensitivity",
  "comps",
  "after_tax",
] as const;
type SectionId = (typeof BATCHED_SECTION_IDS)[number];

const BATCH_QUERY_KEY = "ai-insight-batch" as const;

export function useSectionAiInsights({
  enabled,
  input,
  rental,
  flip,
  brrrr,
  rentcast,
  piq,
  grading,
  strategy,
  piqByGeo,
  goal,
}: UseSectionAiInsightsArgs): Record<SectionId, SectionAiProps> {
  const qc = useQueryClient();

  const payload: AiInsightPayload = {
    input,
    result: { rental, flip, brrrr },
    rentcast,
    piq,
    grading: grading ?? undefined,
    strategy,
    piqByGeo: {
      zip: piqByGeo.zip,
      county: piqByGeo.county,
      metro: piqByGeo.metro,
    },
    goal: goal ?? null,
  };

  // Discriminator mirrors the backend's cache key fields so the two layers
  // stay aligned: re-fetch when PIQ scores by geo, resolved geo level,
  // grading letter, strategy, or goal change.
  const discriminator = [
    piqByGeo.metro ?? "",
    piqByGeo.county ?? "",
    piqByGeo.zip ?? "",
    typeof piq === "object" && piq && "geo_level" in piq
      ? ((piq as { geo_level?: string }).geo_level ?? "")
      : "",
    grading?.letter ?? "",
    strategy ?? "",
    goal ?? "",
  ].join("|");

  // recommendation_analysis is gated on grading existing — same as before.
  // For the batched call, simplest correct behavior is to gate the whole
  // batch on enabled (other sections don't need grading; if grading is
  // missing the recommendation will be a no-op in the response).
  const query = useQuery<AIAnnotationBatch, Error>({
    queryKey: [BATCH_QUERY_KEY, discriminator],
    queryFn: () => fetchBatchedAiInsights(payload),
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h matches backend cache TTL
  });

  const refreshAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: [BATCH_QUERY_KEY] });
  }, [qc]);

  const toProps = (sectionId: SectionId): SectionAiProps => {
    const section = query.data?.[sectionId];
    return {
      aiText: section?.text ?? null,
      aiIsLoading: query.isLoading,
      aiIsStale: Boolean(section?.cacheHit),
      onRefreshAi: refreshAll,
    };
  };

  return {
    recommendation_analysis: toProps("recommendation_analysis"),
    projection: toProps("projection"),
    expense_waterfall: toProps("expense_waterfall"),
    sensitivity: toProps("sensitivity"),
    comps: toProps("comps"),
    after_tax: toProps("after_tax"),
  };
}
