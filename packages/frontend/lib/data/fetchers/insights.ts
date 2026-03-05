/**
 * INSIGHT FETCHER
 *
 * Fetches AI-generated market insights for a given geography.
 */

import { fetchAPI } from "./base";

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
