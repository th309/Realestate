/**
 * RECOMMENDATIONS DATA FETCHERS
 *
 * API functions for personalized market recommendations.
 */

import { fetchAPIRaw } from './base';
import { getAuthHeaders } from './auth-headers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketRecommendation {
  geography_type: string;
  geography_id: string;
  geography_name: string;
  score: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch personalized "markets to watch" recommendations for the current user.
 */
export async function fetchMarketsToWatch(): Promise<MarketRecommendation[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/recommendations/markets-to-watch', {
    headers: authHeaders,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}
