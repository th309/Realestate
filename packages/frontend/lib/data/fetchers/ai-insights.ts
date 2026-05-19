/**
 * AI INSIGHTS FETCHER
 *
 * POST /api/analyzer/ai-insights/section returns a per-section AI annotation
 * derived from the deal payload. 24-hour Redis cache backend-side; the
 * `cacheHit` flag tells the UI whether to mark the annotation stale.
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export type AnalyzerSectionId =
  | "recommendation_analysis"
  | "projection"
  | "expense_waterfall"
  | "sensitivity"
  | "comps"
  | "market_context"
  | "after_tax";

export interface AiInsightPayload {
  input: unknown;
  result: unknown;
  rentcast: unknown;
  piq: unknown;
  /** Optional DealGradingResult snapshot. Required for the
   *  recommendation_analysis section; other sections ignore it. */
  grading?: unknown;
  /** Active strategy. Drives strategy-specific guidance in the backend
   *  prompt so AI output is framed in the right terms for the user's play. */
  strategy?: "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR" | null;
  /** PIQ scores at metro / county / zip. Surfaced to the AI with stability
   *  annotations so it leads with the most stable available level instead
   *  of citing the noisy ZIP score as gospel. */
  piqByGeo?: {
    zip?: number | null;
    county?: number | null;
    metro?: number | null;
  };
  /** Investor goal for the "Help me decide" recommender. When set, the
   *  recommendation_analysis prompt frames its narrative around this goal. */
  goal?:
    | "cash_flow"
    | "long_term_wealth"
    | "fast_cash"
    | "recycle_capital"
    | null;
}

export interface AIAnnotationResult {
  text: string;
  threadId: string;
  citedFacts: string[];
  cacheHit: boolean;
}

export async function fetchAiInsight(params: {
  id: AnalyzerSectionId;
  payload: AiInsightPayload;
}): Promise<AIAnnotationResult> {
  const url = `${API_URL}/api/analyzer/ai-insights/section`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`ai-insights ${res.status}`);
  return (await res.json()) as AIAnnotationResult;
}
