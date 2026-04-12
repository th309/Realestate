/**
 * SOCIAL PROOF FETCHER
 *
 * Fetches aggregate engagement stats for a geography (views, score checks,
 * reports generated, investors tracking) used to display social proof signals.
 */

import { fetchAPI } from "./base";

// ============================================================================
// TYPES
// ============================================================================

export interface SocialProofStats {
  views: number;
  scoreChecks: number;
  reports: number;
  tracking: number;
}

interface SocialProofResponse {
  success: boolean;
  data: SocialProofStats;
}

// ============================================================================
// FETCHER
// ============================================================================

/**
 * Fetch social proof stats for a given geography.
 * Returns view counts, score checks, reports generated, and investor tracking
 * numbers for the specified region.
 */
export async function fetchSocialProof(
  geoLevel: string,
  geoId: string,
): Promise<SocialProofStats> {
  const response = await fetchAPI<SocialProofResponse>(
    `/api/analytics/social-proof/${geoLevel}/${geoId}`,
  );
  return response.data;
}
