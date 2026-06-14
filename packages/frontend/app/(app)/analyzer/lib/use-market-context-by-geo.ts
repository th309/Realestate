"use client";

/**
 * useMarketContextByGeo — prefetch market context + AI annotation for every
 * geo level present in a property's parent chain (metro / county / zip).
 *
 * The Market Context section lets the user toggle between geo levels via
 * pills. Fetching only the active pill's data + AI on demand makes each
 * pill click feel sluggish (1-3s wait on cold AI calls). Instead, we fire
 * up-to-3 parallel `useMarketContext` and 3 parallel `useAiSectionAnnotation`
 * requests at mount; the pill toggle then just picks the cached result.
 *
 * Each AI call is keyed per geo via `cacheKeyExtra` so React Query treats
 * them as distinct queries (the AI payload's `piq` slice serializes far
 * past the queryKey's 200-char truncation, so the queryKey alone wouldn't
 * disambiguate them).
 *
 * Gating: each pair is only enabled when (a) the geo id exists on the
 * chain, (b) the caller's `enabled` flag is true (Pro + has gradable input),
 * and (c) for the AI fetch, the corresponding market data has resolved
 * (`piq=null` would yield a useless "data unavailable" annotation).
 */

import { useMemo } from "react";
import {
  useMarketContext,
  useAiSectionAnnotation,
  type AiInsightPayload,
} from "@/lib/data";
import type {
  MarketContext,
  MarketContextChain,
} from "@/lib/data/fetchers/analyzer";

export type PillLevel = "zip" | "county" | "metro";

export interface MarketContextAiSlot {
  text: string | null;
  isLoading: boolean;
  isStale: boolean;
  /** True iff this pill's geo id exists on the chain. */
  available: boolean;
}

export interface MarketContextByGeo {
  dataByPill: Record<PillLevel, MarketContext | null>;
  sourceByPill: Record<PillLevel, "live" | "missing">;
  aiByPill: Record<PillLevel, MarketContextAiSlot>;
}

interface UseMarketContextByGeoArgs {
  chain: MarketContextChain | null;
  /** Base payload (input/result/rentcast). When undefined, AI calls are skipped. */
  aiPayloadBase: Omit<AiInsightPayload, "piq"> | undefined;
  /** Pro + has-input gate from the parent. */
  aiEnabled: boolean;
}

export function useMarketContextByGeo({
  chain,
  aiPayloadBase,
  aiEnabled,
}: UseMarketContextByGeoArgs): MarketContextByGeo {
  const metroId = chain?.cbsa_code ?? null;
  const countyId = chain?.county_fips ?? null;
  const zipId = chain?.zip ?? null;

  // Three parallel data fetches — React Query dedupes per queryKey.
  const metroCtx = useMarketContext({
    cbsa_code: metroId ?? undefined,
    enabled: !!metroId,
  });
  const countyCtx = useMarketContext({
    county_fips: countyId ?? undefined,
    enabled: !!countyId,
  });
  const zipCtx = useMarketContext({
    zip: zipId ?? undefined,
    enabled: !!zipId,
  });

  // Three parallel AI fetches. Each gates on its own data being resolved so
  // we don't burn a prompt cycle with `piq=null`. `cacheKeyExtra` disambiguates
  // the three otherwise-identical queryKeys (same sectionId, same first 200
  // chars of payload).
  const aiBase: AiInsightPayload = aiPayloadBase
    ? { ...aiPayloadBase, piq: null }
    : { input: null, result: null, rentcast: null, piq: null };

  const metroAi = useAiSectionAnnotation(
    { ...aiBase, piq: metroCtx.data ?? null },
    "market_context",
    Boolean(aiPayloadBase && aiEnabled && metroId && metroCtx.data),
    `metro:${metroId ?? ""}`,
  );
  const countyAi = useAiSectionAnnotation(
    { ...aiBase, piq: countyCtx.data ?? null },
    "market_context",
    Boolean(aiPayloadBase && aiEnabled && countyId && countyCtx.data),
    `county:${countyId ?? ""}`,
  );
  const zipAi = useAiSectionAnnotation(
    { ...aiBase, piq: zipCtx.data ?? null },
    "market_context",
    Boolean(aiPayloadBase && aiEnabled && zipId && zipCtx.data),
    `zip:${zipId ?? ""}`,
  );

  return useMemo<MarketContextByGeo>(
    () => ({
      dataByPill: {
        metro: metroCtx.data ?? null,
        county: countyCtx.data ?? null,
        zip: zipCtx.data ?? null,
      },
      sourceByPill: {
        metro: metroId ? "live" : "missing",
        county: countyId ? "live" : "missing",
        zip: zipId ? "live" : "missing",
      },
      aiByPill: {
        metro: {
          text: metroAi.data?.text ?? null,
          isLoading: metroAi.isLoading,
          isStale: Boolean(metroAi.data?.cacheHit),
          available: !!metroId,
        },
        county: {
          text: countyAi.data?.text ?? null,
          isLoading: countyAi.isLoading,
          isStale: Boolean(countyAi.data?.cacheHit),
          available: !!countyId,
        },
        zip: {
          text: zipAi.data?.text ?? null,
          isLoading: zipAi.isLoading,
          isStale: Boolean(zipAi.data?.cacheHit),
          available: !!zipId,
        },
      },
    }),
    [
      metroCtx.data,
      countyCtx.data,
      zipCtx.data,
      metroAi.data,
      metroAi.isLoading,
      countyAi.data,
      countyAi.isLoading,
      zipAi.data,
      zipAi.isLoading,
      metroId,
      countyId,
      zipId,
    ],
  );
}
