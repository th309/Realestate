/**
 * MARKET MATCH FETCHERS
 *
 * Functions for fetching personalized market match scores
 * via the NestJS PreferencesModule backend.
 *
 * GET  /api/preferences/match/:geoLevel/top?limit=10 — top matches
 * GET  /api/preferences/match/:geoLevel/:regionId   — single region match
 */

import { fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types (mirrors backend match-score.service.ts output)
// ---------------------------------------------------------------------------

export interface MetricBreakdownEntry {
  percentile: number;
  weight: number;
  contribution: number;
}

export interface MatchScoreResult {
  regionId: string;
  regionName: string;
  matchScore: number;
  budgetMatch: boolean;
  metricBreakdown: Record<string, MetricBreakdownEntry>;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch top market match scores for a geography level.
 * Requires authentication (user must have completed the quiz).
 */
export async function fetchTopMarketMatches(
  geoLevel: string,
  limit: number = 10,
): Promise<MatchScoreResult[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(
    `/api/preferences/match/${geoLevel}/top?limit=${limit}`,
    { headers: authHeaders },
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return [];
    throw new Error(`API error: ${res.status}`);
  }

  const body = (await res.json()) as {
    success: boolean;
    data: MatchScoreResult[];
  };
  return body.data ?? [];
}

/**
 * Fetch the match score for a single region.
 * Returns null if the user has no preferences or the region is not found.
 */
export async function fetchMarketMatch(
  geoLevel: string,
  regionId: string,
): Promise<MatchScoreResult | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(
    `/api/preferences/match/${geoLevel}/${encodeURIComponent(regionId)}`,
    { headers: authHeaders },
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return null;
    }
    throw new Error(`API error: ${res.status}`);
  }

  const body = (await res.json()) as {
    success: boolean;
    data: MatchScoreResult | null;
  };
  return body.data;
}
