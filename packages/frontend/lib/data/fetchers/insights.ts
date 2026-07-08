/**
 * INSIGHT FETCHER
 *
 * Fetches AI-generated market insights for a given geography.
 */

import { fetchAPI, fetchAPICached } from "./base";
import { SEO_MARKET_CACHE_TAG } from "./market-stats";

export interface InsightData {
  content: string;
  generated_at: string;
  model: string;
}

export async function fetchInsight(
  geoLevel: string,
  regionId: string,
  insightType: string = "market_take",
  archetypeId?: string,
): Promise<InsightData | null> {
  try {
    const params = new URLSearchParams({ type: insightType });
    if (archetypeId) params.set("archetype", archetypeId);
    return await fetchAPI<InsightData>(
      `/api/insights/${geoLevel}/${regionId}?${params}`,
    );
  } catch {
    return null;
  }
}

/**
 * Server-only: fetch a PRE-GENERATED (cached) insight for ISR/SEO rendering.
 *
 * Hits the backend with `cachedOnly=1`, which returns the stored narrative or a
 * 404 and NEVER triggers a paid AI generation during a build/revalidate. Rides
 * the shared 24h SEO data cache so it shares the market page's ISR window.
 * Returns null on 404/any error — the caller then renders without a server
 * narrative (the client component may still fetch a live one for real visitors).
 */
export async function fetchCachedInsight(
  geoLevel: string,
  regionId: string,
  insightType: string = "market_overview",
): Promise<InsightData | null> {
  try {
    return await fetchAPICached<InsightData>(
      `/api/insights/${geoLevel}/${regionId}`,
      { type: insightType, cachedOnly: "1" },
      { revalidate: 86400, tags: [SEO_MARKET_CACHE_TAG] },
    );
  } catch {
    return null;
  }
}
