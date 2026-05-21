/**
 * DEAL GRADING FETCHER
 *
 * POST /api/analyzer/grade — runs the analyzer-core grading engine on the
 * server (single source of truth for thresholds + scoring). Returns the
 * full `DealGradingResult` (overall letter, GPA, metric breakdown,
 * auto-kill flags, advisories).
 *
 * Idempotent for a given (strategy, input, context, overrideThresholds);
 * the hook layer uses React Query caching keyed off the payload.
 */

import {
  type DealGradingResult,
  type DealInput,
  type Strategy,
  type UserThresholds,
} from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface GradeDealRequest {
  strategy: Strategy;
  input: DealInput;
  context?: {
    floodZone?: "AE" | "VE" | "A" | "X" | null;
    floodInsuranceQuoted?: boolean;
    appreciationPlayAccepted?: boolean;
    marketPiqScore?: number;
  };
  overrideThresholds?: UserThresholds;
}

export async function fetchGradeDeal(
  payload: GradeDealRequest,
): Promise<DealGradingResult> {
  const url = `${API_URL}/api/analyzer/grade`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`grade ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as DealGradingResult;
}
