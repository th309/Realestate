/**
 * MARKET ANALYSIS FETCHER
 *
 * Fetches AI-generated market analysis from the backend.
 * Single call returns both homebuyer and investor perspectives.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface MarketAnalysisSection {
  title: string;
  analysis: string;
}

export interface MarketAnalysisResult {
  homebuyer: MarketAnalysisSection[];
  investor: MarketAnalysisSection[];
  generatedAt: string;
  cached: boolean;
}

export async function fetchMarketAnalysis(
  geoType: string,
  geoId: string,
  payload: {
    geoName: string;
    metrics: Record<
      string,
      { value: number | null; formatted: string; change: number | null }
    >;
    scores: {
      propertyiq: { score: number; grade: string } | null;
    };
    lastUpdated?: string;
  },
): Promise<MarketAnalysisResult> {
  const url = `${API_URL}/api/markets/${geoType}/${geoId}/ai-analysis`;
  // The backend route is guarded by JwtAuthGuard — it needs the Supabase JWT in
  // an Authorization: Bearer header (cookies alone are not honored), same as
  // every other authed fetcher. Omitting this 401'd the call for ALL users.
  const authHeaders = await getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      geoName: payload.geoName,
      metrics: payload.metrics,
      scores: payload.scores,
      lastUpdated: payload.lastUpdated,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI analysis request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.analysis;
}
