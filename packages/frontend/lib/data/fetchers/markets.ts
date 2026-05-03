/**
 * MARKETS DATA FETCHER
 *
 * Fetches market-level data like stats, lists of metros/counties/zips, etc.
 */

import { fetchAPI, API_URL } from "./base";

export interface MarketStats {
  totalMarkets: number;
  totalStates: number;
  totalCounties: number;
  totalZips: number;
}

/**
 * Fetch market statistics (counts of markets by geography level)
 */
export async function fetchMarketStats(): Promise<MarketStats> {
  return fetchAPI<MarketStats>("/api/markets/stats");
}

/**
 * A peer market candidate returned by /api/markets/peers/:geoLevel/:geoId.
 * Peers are similar markets surfaced for side-by-side comparison.
 */
export interface PeerCandidate {
  geoLevel: "metro" | "county" | "city" | "zip";
  geoId: string;
  name: string;
  score: number;
  householdCount: number;
}

export interface PeersResponse {
  source: { geoLevel: string; geoId: string; name: string; score: number };
  peers: PeerCandidate[];
}

/**
 * Fetch peer markets for a given source market. Backed by the Phase-01
 * `/api/markets/peers/:geoLevel/:geoId` endpoint.
 */
export async function fetchPeers(
  geoLevel: string,
  geoId: string,
): Promise<PeersResponse> {
  const res = await fetch(`${API_URL}/api/markets/peers/${geoLevel}/${geoId}`);
  if (!res.ok) throw new Error(`Peers fetch failed: ${res.status}`);
  return res.json();
}
