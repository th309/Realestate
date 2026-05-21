/**
 * BRRRR UPGRADE-PATH FETCHER — separate file from upgrade-path.ts and
 * upgrade-path-flip.ts so the B&H + F&F surfaces stay exactly at their
 * committed shapes.
 *
 * POST /api/analyzer/upgrade-path-brrrr → computeBrrrrUpgradePath on the
 * server. Lever set: purchasePrice, arv, rehabCost, refiLtvPct, monthlyRent,
 * holdMonthsBeforeRefi, refiRate.
 */
import type {
  BrrrrThresholds,
  BrrrrUpgradePathResult,
  Letter,
} from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";
import type { BrrrrGradeRequest } from "./grade-brrrr";

export interface UpgradePathBrrrrRequest {
  input: BrrrrGradeRequest["input"];
  context?: BrrrrGradeRequest["context"];
  targetGrade: Letter;
  overrideThresholds?: BrrrrThresholds;
}

export async function fetchUpgradePathBrrrr(
  payload: UpgradePathBrrrrRequest,
): Promise<BrrrrUpgradePathResult> {
  const url = `${API_URL}/api/analyzer/upgrade-path-brrrr`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`upgrade-path-brrrr ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as BrrrrUpgradePathResult;
}
