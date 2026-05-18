"use client";

/**
 * Per-section AI insights for the analyzer page. Calls the data layer
 * `useAiSectionAnnotation` hook once per section (6 sections) and returns a
 * map of `{ aiText, aiIsLoading, aiIsStale, onRefreshAi }` per section.
 *
 * The endpoint is Pro-gated server-side. We disable the fetch entirely for
 * non-Pro users to avoid 403 noise. We also require minimum data
 * (`hasGradableInput`) before calling so the LLM has something to summarize.
 *
 * Cache stale-detection: backend returns `cacheHit: true` when the response
 * came from Redis (24h TTL). We flag those as `isStale` so the UI shows a
 * subtle refresh affordance — the data is still useful, but the user can ask
 * for a fresh take if the deal has materially changed.
 */
import { useCallback } from "react";
import type {
  BrrrrResult,
  DealInput,
  FlipResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import { useAiSectionAnnotation, type AiInsightPayload } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";

export interface UseSectionAiInsightsArgs {
  enabled: boolean;
  input: DealInput;
  rental: RentalResult | null | undefined;
  flip: FlipResult | null | undefined;
  brrrr: BrrrrResult | null | undefined;
  rentcast: unknown;
  piq: unknown;
}

export interface SectionAiProps {
  aiText: string | null;
  aiIsLoading: boolean;
  aiIsStale: boolean;
  onRefreshAi: () => void;
}

const SECTION_IDS = [
  "projection",
  "expense_waterfall",
  "sensitivity",
  "comps",
  "market_context",
  "after_tax",
] as const;
type SectionId = (typeof SECTION_IDS)[number];

export function useSectionAiInsights({
  enabled,
  input,
  rental,
  flip,
  brrrr,
  rentcast,
  piq,
}: UseSectionAiInsightsArgs): Record<SectionId, SectionAiProps> {
  const qc = useQueryClient();

  // Same payload for every section — the LLM picks out what's relevant to its
  // assigned section. The backend dedupes responses 24h via Redis cache.
  const payload: AiInsightPayload = {
    input,
    result: { rental, flip, brrrr },
    rentcast,
    piq,
  };

  const projection = useAiSectionAnnotation(payload, "projection", enabled);
  const expense = useAiSectionAnnotation(payload, "expense_waterfall", enabled);
  const sensitivity = useAiSectionAnnotation(payload, "sensitivity", enabled);
  const comps = useAiSectionAnnotation(payload, "comps", enabled);
  const market = useAiSectionAnnotation(payload, "market_context", enabled);
  const afterTax = useAiSectionAnnotation(payload, "after_tax", enabled);

  const buildRefresh = useCallback(
    (sectionId: SectionId) => () => {
      qc.invalidateQueries({ queryKey: ["ai-insight", sectionId] });
    },
    [qc],
  );

  const toProps = (
    sectionId: SectionId,
    q: ReturnType<typeof useAiSectionAnnotation>,
  ): SectionAiProps => ({
    aiText: q.data?.text ?? null,
    aiIsLoading: q.isLoading,
    aiIsStale: Boolean(q.data?.cacheHit),
    onRefreshAi: buildRefresh(sectionId),
  });

  return {
    projection: toProps("projection", projection),
    expense_waterfall: toProps("expense_waterfall", expense),
    sensitivity: toProps("sensitivity", sensitivity),
    comps: toProps("comps", comps),
    market_context: toProps("market_context", market),
    after_tax: toProps("after_tax", afterTax),
  };
}
