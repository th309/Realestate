/**
 * SCORE DATA FETCHER
 *
 * Fetches PropertyIQ score data for specific geographies.
 * Supports single, batch, and top-ranked score fetching.
 */

import type { ScoreResponse, BatchScoreResponse } from "../types";
import { ApiError, fetchAPI, fetchAPICached, fetchAPIWithParams } from "./base";
import { SEO_MARKET_CACHE_TAG } from "./market-stats";

/**
 * A 404 from the scores endpoint means "no PropertyIQ score for this
 * geography" — an expected outcome for the ~5,376 ZIPs / 87 counties that
 * exist in search but aren't scored. Callers render "—" for these, so it is
 * not error-worthy: logging it pops Next's dev "Console Error" overlay during
 * the tour. Treat it as a normal empty result and stay silent.
 */
function isNoScore(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// ============================================================================
// TOP MARKETS TYPES
// ============================================================================

export type TopMarketsGeo = "metro" | "county" | "zip";
export type TopMarketsScoreType = "propertyiq";

export interface TopMarketEntry {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
}

// ============================================================================
// TOP MARKETS FETCHER
// ============================================================================

/**
 * Fetch top-ranked markets by score
 *
 * @param geography - Geography level: metro, county, or zip
 * @param scoreType - Score to rank by (only "propertyiq" supported)
 * @param limit - Number of results (1-100, default 10)
 */
export async function fetchTopMarkets(
  geography: TopMarketsGeo,
  scoreType: TopMarketsScoreType,
  limit: number = 10,
  state?: string,
  sort?: "asc" | "desc",
): Promise<TopMarketEntry[]> {
  try {
    const params: Record<string, string> = {
      geography,
      score_type: scoreType,
      limit: String(limit),
    };
    if (state) params.state = state;
    if (sort) params.sort = sort;

    const data = await fetchAPIWithParams<TopMarketEntry[]>(
      "/api/scores/top",
      params,
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch top markets:", error);
    return [];
  }
}

/**
 * Fetch the scored location IDs + their refresh date for a geography level.
 *
 * Backs SEO sitemap filtering + per-page noindex (a ZIP/county/metro is only
 * indexable when it has a PropertyIQ score) and honest sitemap `<lastmod>`
 * (`date` = the geo's real latest score period). Hits the lean ID-only endpoint
 * (small, cacheable payload — unlike /scores/all). Returns empty/null on
 * failure so callers can fail OPEN (keep the full slug list / leave pages
 * indexable rather than emptying the sitemap on a transient backend blip).
 */
export async function fetchScoredLocationData(
  geography: "metro" | "county" | "zip",
): Promise<{ date: string | null; ids: string[] }> {
  try {
    const res = await fetchAPICached<{ date?: string | null; ids?: string[] }>(
      `/api/scores/ids/${geography}`,
      { score_type: "propertyiq" },
      { revalidate: 86400, tags: [SEO_MARKET_CACHE_TAG] },
    );
    return {
      date: res?.date ?? null,
      ids: Array.isArray(res?.ids) ? res.ids : [],
    };
  } catch {
    return { date: null, ids: [] };
  }
}

/** Scored location IDs only (the indexability gate doesn't need the date). */
export async function fetchScoredLocationIds(
  geography: "metro" | "county" | "zip",
): Promise<string[]> {
  return (await fetchScoredLocationData(geography)).ids;
}

/**
 * Fetch PropertyIQ score for a specific geography
 *
 * @param geographyType - The geography type (metro, county, zip)
 * @param geographyId - The geography identifier
 * @returns Promise<ScoreResponse | null>
 */
export async function fetchScore(
  geographyType: string,
  geographyId: string,
): Promise<ScoreResponse | null> {
  try {
    const response = await fetchAPI<ScoreResponse>(
      `/api/scores/${geographyType}/${geographyId}`,
    );
    return response;
  } catch (error) {
    if (isNoScore(error)) return null;
    console.error("Failed to fetch score:", error);
    return null;
  }
}

/**
 * Fetch scores for multiple geographies
 *
 * @param geographyType - The geography type
 * @param ids - Array of geography identifiers
 * @returns Promise<BatchScoreResponse | null>
 */
export async function fetchBatchScores(
  geographyType: string,
  ids: string[],
): Promise<BatchScoreResponse | null> {
  try {
    const response = await fetchAPI<BatchScoreResponse>(
      `/api/scores/batch/${geographyType}?ids=${ids.join(",")}`,
    );
    return response;
  } catch (error) {
    console.error("Failed to fetch batch scores:", error);
    return null;
  }
}

/**
 * Fetch score with expanded details and optional history
 *
 * @param geographyType - The geography type
 * @param geographyId - The geography identifier
 * @param options - Optional parameters
 * @returns Promise<ScoreResponse | null>
 */
export async function fetchScoreExpanded(
  geographyType: string,
  geographyId: string,
  options?: {
    expanded?: boolean;
    historyMonths?: number;
  },
): Promise<ScoreResponse | null> {
  try {
    const params = new URLSearchParams();
    if (options?.expanded) params.append("expanded", "true");
    if (options?.historyMonths && options.historyMonths > 0) {
      params.append("historyMonths", options.historyMonths.toString());
    }

    const queryString = params.toString();
    const endpoint = `/api/scores/${geographyType}/${encodeURIComponent(geographyId)}${queryString ? `?${queryString}` : ""}`;

    return await fetchAPI<ScoreResponse>(endpoint);
  } catch (error) {
    if (isNoScore(error)) return null;
    console.error("Failed to fetch expanded score:", error);
    return null;
  }
}
