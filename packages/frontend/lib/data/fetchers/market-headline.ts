/**
 * MARKET HEADLINE FETCHER
 *
 * Fetches the short AI-written headline + summary framing for the market
 * detail page. Mirrors market-analysis.ts (same auth + POST contract), but
 * hits the lighter ai-headline route.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface MarketHeadlineResult {
  headline: string;
  summary: string;
  generatedAt: string;
  cached: boolean;
}

export async function fetchMarketHeadline(
  geoType: string,
  geoId: string,
  payload: {
    geoName: string;
    audience: "homebuyer" | "investor";
    metrics: Record<
      string,
      { value: number | null; formatted: string; change: number | null }
    >;
    scores: {
      propertyiq: { score: number; grade: string } | null;
    };
  },
): Promise<MarketHeadlineResult> {
  const url = `${API_URL}/api/markets/${geoType}/${geoId}/ai-headline`;
  // Same JwtAuthGuard contract as every other authed fetcher — needs the
  // Supabase JWT in an Authorization: Bearer header (cookies alone are not honored).
  const authHeaders = await getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      geoName: payload.geoName,
      audience: payload.audience,
      metrics: payload.metrics,
      scores: payload.scores,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI headline request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.headline;
}
