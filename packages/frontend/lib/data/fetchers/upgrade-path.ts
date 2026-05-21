/**
 * UPGRADE-PATH FETCHER
 *
 * POST /api/analyzer/upgrade-path — runs the analyzer-core upgrade-path
 * engine on the server. Given a deal that grades below a target letter,
 * the engine returns the smallest single-lever moves (price, rent, down
 * payment, rate) that would lift the deal to the target grade, plus a
 * combination hint when no single lever can reach it.
 *
 * Idempotent for a given payload — the hook layer (`useUpgradePath`) keys
 * React Query off the payload hash.
 */

import {
  type DealInput,
  type GradingContext,
  type Letter,
  type Strategy,
  type UpgradePathResult,
  type UserThresholds,
} from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export interface UpgradePathRequest {
  strategy: Strategy;
  input: DealInput;
  context?: GradingContext;
  targetGrade: Letter;
  overrideThresholds?: UserThresholds;
}

export async function fetchUpgradePath(
  payload: UpgradePathRequest,
): Promise<UpgradePathResult> {
  const url = `${API_URL}/api/analyzer/upgrade-path`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`upgrade-path ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as UpgradePathResult;
}
