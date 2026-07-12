/**
 * ANALYZER FETCHERS
 *
 * Data layer for the Deal Analyzer feature.
 * - Market context (geo-aware metric summary for an address)
 * - AI verdict (SSE stream of model output)
 * - Save / list / share user-saved analyses
 *
 * Uses the shared `API_URL` resolver from `./base` so production builds
 * route to the correct backend host (see base.ts).
 */

import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ============================================================================
// MARKET CONTEXT
// ============================================================================

export interface MarketContextMetric {
  value: number | null;
  source: string | null;
}

/**
 * Geography parent chain — IDs at every level the requested geo rolls up to.
 * Each field is optional; unmetropolitan ZIPs have no `cbsa_code`, etc.
 * Lets the UI offer "view at metro / county / zip" pills without an extra RTT.
 */
export interface MarketContextChain {
  zip?: string;
  county_fips?: string;
  cbsa_code?: string;
  state?: string;
}

export interface MarketContext {
  geo_level: "zip" | "county" | "metro" | "state" | null;
  geo_id: string | null;
  home_value: MarketContextMetric | null;
  /** Home-value YoY appreciation as a percent (e.g. 6.2 = +6.2%). */
  home_value_yoy: MarketContextMetric | null;
  rent_index: MarketContextMetric | null;
  market_heat: MarketContextMetric | null;
  net_migration: MarketContextMetric | null;
  piq_score: { value: number; label: string } | null;
  /** Null when no geography was identified or the chain lookup failed. */
  chain: MarketContextChain | null;
}

export interface MarketContextParams {
  zip?: string;
  county_fips?: string;
  /** Metro CBSA code — analyzer geo-pills use this when user picks "Metro". */
  cbsa_code?: string;
  state?: string;
}

export type MarketContextResult =
  | MarketContext
  | { quotaExceeded: true }
  | null;

/**
 * Fetch market context for an address.
 * Returns `{ quotaExceeded: true }` on HTTP 402 so callers can surface a
 * paywall without conflating it with a generic error.
 */
export async function fetchMarketContext(
  params: MarketContextParams,
): Promise<MarketContextResult> {
  const qs = new URLSearchParams();
  if (params.zip) qs.set("zip", params.zip);
  if (params.county_fips) qs.set("county_fips", params.county_fips);
  if (params.cbsa_code) qs.set("cbsa_code", params.cbsa_code);
  if (params.state) qs.set("state", params.state);

  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/market-context?${qs}`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (res.status === 402) return { quotaExceeded: true };
  // 5xx is transient: throw so React Query retries and useMarketContext's
  // error-state self-heal kicks in, instead of caching null as a success
  // for the 2h staleTime. 4xx (auth, unknown geo) stays fail-soft null.
  if (res.status >= 500) throw new Error(`market-context ${res.status}`);
  if (!res.ok) return null;
  return res.json();
}

// ============================================================================
// AI VERDICT (SSE STREAM)
// ============================================================================

/**
 * Sentinel error thrown when the backend signals an error frame
 * (e.g. `data: {"error":"…"}`). Distinguishes backend-signaled failures
 * from incidental JSON.parse failures on partial SSE frames so the latter
 * can be safely swallowed while the former propagate to the caller.
 */
class StreamError extends Error {}

export interface AiVerdictResult {
  verdict: "buy" | "negotiate" | "pass";
  target_price: number | null;
  strengths: string[];
  risks: string[];
  reasoning: string;
}

/**
 * Stream AI verdict chunks. Yields raw text chunks as they arrive.
 * Caller is responsible for parsing the final accumulated text into
 * `AiVerdictResult` (typically by the backend emitting a structured JSON
 * chunk at the end).
 */
export async function* streamAiVerdict(payload: {
  input: unknown;
  result: unknown;
  marketContext?: unknown;
}): AsyncGenerator<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/ai-verdict`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    throw new Error(`ai-verdict failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.chunk) yield parsed.chunk as string;
        if (parsed.error) throw new StreamError(parsed.error);
      } catch (e) {
        if (e instanceof StreamError) throw e;
        // Malformed JSON frame — skip and continue reading.
      }
    }
  }
}

// ============================================================================
// SAVED ANALYSES
// ============================================================================

export interface SavedAnalysis {
  id: string;
  share_token: string;
  label: string | null;
  address_full: string | null;
  address_city: string;
  address_state: string;
  address_zip: string | null;
  lat: number | null;
  lon: number | null;
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  market_context: Record<string, unknown> | null;
  ai_verdict: Record<string, unknown> | null;
  created_at: string;
}

export type SaveAnalysisPayload = Omit<
  SavedAnalysis,
  "id" | "share_token" | "created_at"
>;

export async function saveAnalysis(
  payload: SaveAnalysisPayload,
): Promise<{ id: string; share_token: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/save`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return res.json();
}

export async function fetchSavedAnalyses(): Promise<SavedAnalysis[]> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/saved`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSharedAnalysis(
  token: string,
): Promise<SavedAnalysis | null> {
  // Public endpoint — no auth headers needed; share token is the capability.
  const res = await fetch(`${API_URL}/api/analyzer/share/${token}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchSavedAnalysis(
  id: string,
): Promise<SavedAnalysis | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/saved/${id}`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (!res.ok) return null;
  return res.json();
}

export {
  fetchSharedAnalysisBranding,
  downloadAnalysisPdf,
  sendAnalysisShareEmail,
  type SharedAnalysisBranding,
} from "./analyzer-share";
