/**
 * MARKET ANALYSIS FETCHER
 *
 * Fetches AI-generated market analysis from the backend.
 * Single call returns both homebuyer and investor perspectives.
 */

import { API_URL } from './base';

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
    metrics: Record<string, { value: number | null; formatted: string; change: number | null }>;
    scores: {
      homeready: { score: number; grade: string };
      investoredge: { score: number; grade: string };
      markethealth: { score: number; grade: string };
    };
    lastUpdated?: string;
  },
): Promise<MarketAnalysisResult> {
  const url = `${API_URL}/api/markets/${geoType}/${geoId}/ai-analysis`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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
