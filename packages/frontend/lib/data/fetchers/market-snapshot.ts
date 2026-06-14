/**
 * MARKET SNAPSHOT FETCHER
 *
 * Fetches all metric values + scores for a single region in one HTTP call.
 * Replaces 57+ individual snapshot API calls on the Markets page.
 */

import { fetchAPIWithParams, fetchAPICached } from "./base";

export interface MarketSnapshotMetric {
  value: number | null;
  date: string | null;
  source: string;
  sourceGeoId: string | null;
  sourceGeoLevel: "metro" | "county" | "zip" | "state" | "national" | null;
  isInherited: boolean;
  isFallback: boolean;
}

export interface MarketSnapshotScoreEntry {
  score: number;
  grade: string;
  components?: Record<string, number>;
}

export interface MarketSnapshotResponse {
  success: boolean;
  geography: {
    id: string;
    name: string;
    type: string;
  };
  scores: {
    propertyiq: MarketSnapshotScoreEntry | null;
  };
  metrics: Record<string, MarketSnapshotMetric>;
  lastUpdated: string;
}

/**
 * Fetch all metrics + scores for a single region in one request.
 *
 * @param geoType - metro, county, zip, or state
 * @param geoId - Region identifier (CBSA code, FIPS, ZIP)
 * @param state - Optional state filter (for county/zip)
 * @param cache - When provided, uses cacheable ISR fetch instead of no-store
 */
export async function fetchMarketSnapshot(
  geoType: string,
  geoId: string,
  state?: string,
  cache?: { revalidate: number; tags?: string[] },
): Promise<MarketSnapshotResponse> {
  const path = `/api/market-snapshot/${geoType}/${geoId}`;
  if (cache) {
    return fetchAPICached<MarketSnapshotResponse>(
      path,
      state ? { state } : undefined,
      cache,
    );
  }
  return fetchAPIWithParams<MarketSnapshotResponse>(
    path,
    state ? { state } : undefined,
  );
}
