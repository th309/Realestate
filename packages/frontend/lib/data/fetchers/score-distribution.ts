/**
 * SCORE DISTRIBUTION FETCHER
 *
 * Momentum-band distribution across all scored markets at the latest period.
 * Powers the /forecast national hub.
 */

import { fetchAPICached } from "./base";
import { SEO_MARKET_CACHE_TAG } from "./market-stats";

export interface ScoreDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ScoreDistributionData {
  date: string | null;
  total: number;
  buckets: ScoreDistributionBucket[];
}

/**
 * Momentum-band distribution across all scored markets at the latest period.
 * Powers the /forecast national hub. Server-cached like the other SEO fetchers.
 */
export async function fetchScoreDistribution(
  geography: "metro" | "county" | "zip",
): Promise<ScoreDistributionData | null> {
  try {
    return await fetchAPICached<ScoreDistributionData>(
      `/api/scores/distribution`,
      { geography, score_type: "propertyiq" },
      { revalidate: 86400, tags: [SEO_MARKET_CACHE_TAG] },
    );
  } catch {
    return null;
  }
}
