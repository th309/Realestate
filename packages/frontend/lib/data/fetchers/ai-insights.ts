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

/** Sections returned by the batched endpoint. Excludes `header_verdict`
 *  (streams via SSE) and `market_context` (fired per-geo from inside
 *  MarketContextSection). */
export type BatchedAnalyzerSectionId = Exclude<
  AnalyzerSectionId,
  "market_context"
>;

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

/**
 * Backoff schedule for 429 retries. We expect 429s to be brief — the global
 * throttle short-window is 1 second. Three retries at ~0.5s, 1.2s, 2.5s
 * gives the throttle plenty of room to drain before giving up.
 */
const RETRY_BACKOFF_MS_429 = [500, 1200, 2500];

export async function fetchAiInsight(params: {
  id: AnalyzerSectionId;
  payload: AiInsightPayload;
}): Promise<AIAnnotationResult> {
  const url = `${API_URL}/api/analyzer/ai-insights/section`;
  const headers = await getAuthHeaders();
  const body = JSON.stringify(params);

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS_429.length; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });
    if (res.ok) return (await res.json()) as AIAnnotationResult;

    // Retry only on 429 — other errors are not throttle-related and won't
    // resolve by waiting. Final 429 falls through to the throw below.
    if (res.status === 429 && attempt < RETRY_BACKOFF_MS_429.length) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS_429[attempt]));
      continue;
    }
    throw new Error(`ai-insights ${res.status}`);
  }
  throw new Error("ai-insights 429 (exhausted retries)");
}

export type AIAnnotationBatch = Record<
  BatchedAnalyzerSectionId,
  AIAnnotationResult
>;

/**
 * Fetch all six section annotations in one call. Replaces the
 * six-concurrent-section-requests pattern. Same retry-on-429 schedule as the
 * per-section fetcher above for defense-in-depth — in practice the 429s that
 * motivated this refactor were upstream (Anthropic), but the local throttle
 * could still fire under heavy load.
 */
export async function fetchBatchedAiInsights(
  payload: AiInsightPayload,
): Promise<AIAnnotationBatch> {
  const url = `${API_URL}/api/analyzer/ai-insights/batch`;
  const headers = await getAuthHeaders();
  const body = JSON.stringify({ payload });

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS_429.length; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });
    if (res.ok) return (await res.json()) as AIAnnotationBatch;

    if (res.status === 429 && attempt < RETRY_BACKOFF_MS_429.length) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS_429[attempt]));
      continue;
    }
    throw new Error(`ai-insights/batch ${res.status}`);
  }
  throw new Error("ai-insights/batch 429 (exhausted retries)");
}
