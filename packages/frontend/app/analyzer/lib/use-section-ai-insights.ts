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
  DealGradingResult,
  DealInput,
  FlipResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import { useAiSectionAnnotation, type AiInsightPayload } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import type { InvestorGoal } from "./goal-types";

export interface UseSectionAiInsightsArgs {
  enabled: boolean;
  input: DealInput;
  rental: RentalResult | null | undefined;
  flip: FlipResult | null | undefined;
  brrrr: BrrrrResult | null | undefined;
  rentcast: unknown;
  piq: unknown;
  /** DealGradingResult — required so the recommendation_analysis prompt can
   *  cite the letter, GPA, auto-kills, and per-metric grades. */
  grading: DealGradingResult | null | undefined;
  /** Active strategy in engine form (BUY_AND_HOLD / FIX_AND_FLIP / BRRRR).
   *  Drives strategy-specific framing in the backend prompts. */
  strategy: "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR" | null;
  /** PIQ scores at metro / county / zip. Surfaced to backend so AI leads
   *  with the most stable available level instead of the noisy ZIP score. */
  piqByGeo: {
    zip: number | null;
    county: number | null;
    metro: number | null;
  };
  /** "Help me decide" investor goal. When set, the backend reframes the
   *  recommendation_analysis narrative around this goal. */
  goal?: InvestorGoal | null;
}

export interface SectionAiProps {
  aiText: string | null;
  aiIsLoading: boolean;
  aiIsStale: boolean;
  onRefreshAi: () => void;
}

// `market_context` is intentionally excluded — that section runs its own
// per-geo AI fetches (one per pill) from inside MarketContextSection so the
// pill toggle is instant.
// `recommendation_analysis` only fires when a grading result exists, so it
// is also gated separately below.
const SECTION_IDS = [
  "recommendation_analysis",
  "projection",
  "expense_waterfall",
  "sensitivity",
  "comps",
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
  grading,
  strategy,
  piqByGeo,
  goal,
}: UseSectionAiInsightsArgs): Record<SectionId, SectionAiProps> {
  const qc = useQueryClient();

  // Same payload for every section — the LLM picks out what's relevant to its
  // assigned section. The backend dedupes responses 24h via Redis cache.
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

  // Discriminator for React Query's cache. useAiSectionAnnotation truncates
  // JSON.stringify(payload) to 200 chars, so fields like `piqByGeo`, `piq`,
  // and `grading.letter` (which serialize past the cutoff) would silently
  // collide across renders — e.g. when metro/county PIQ queries resolve
  // later than ZIP, the queryKey wouldn't update and we'd serve the stale
  // "no geography resolved" response forever.
  //
  // Building this discriminator out of every input that ACTUALLY changes the
  // AI's output (PIQ scores by geo, geo_level, grading letter, strategy)
  // mirrors the backend's own cache key fields so the two layers stay aligned.
  const piqDiscriminator = [
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

  const recommendation = useAiSectionAnnotation(
    payload,
    "recommendation_analysis",
    enabled && !!grading,
    piqDiscriminator,
  );
  const projection = useAiSectionAnnotation(
    payload,
    "projection",
    enabled,
    piqDiscriminator,
  );
  const expense = useAiSectionAnnotation(
    payload,
    "expense_waterfall",
    enabled,
    piqDiscriminator,
  );
  const sensitivity = useAiSectionAnnotation(
    payload,
    "sensitivity",
    enabled,
    piqDiscriminator,
  );
  const comps = useAiSectionAnnotation(
    payload,
    "comps",
    enabled,
    piqDiscriminator,
  );
  const afterTax = useAiSectionAnnotation(
    payload,
    "after_tax",
    enabled,
    piqDiscriminator,
  );

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
    recommendation_analysis: toProps("recommendation_analysis", recommendation),
    projection: toProps("projection", projection),
    expense_waterfall: toProps("expense_waterfall", expense),
    sensitivity: toProps("sensitivity", sensitivity),
    comps: toProps("comps", comps),
    after_tax: toProps("after_tax", afterTax),
  };
}
