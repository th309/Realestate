/**
 * F&F UPGRADE-PATH FETCHER — separate file from upgrade-path.ts so the B&H
 * surface stays exactly at the committed shape.
 *
 * POST /api/analyzer/upgrade-path-flip → computeFlipUpgradePath on the
 * server. Lever set: purchasePrice, arv, rehabCost, holdMonths,
 * financingRate (last skipped for cash deals).
 */
import type {
  FixAndFlipThresholds,
  FlipUpgradePathResult,
  Letter,
} from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";
import type { FixAndFlipGradeRequest } from "./grade-flip";

export interface UpgradePathFlipRequest {
  input: FixAndFlipGradeRequest["input"];
  context?: FixAndFlipGradeRequest["context"];
  targetGrade: Letter;
  overrideThresholds?: FixAndFlipThresholds;
}

export async function fetchUpgradePathFlip(
  payload: UpgradePathFlipRequest,
): Promise<FlipUpgradePathResult> {
  const url = `${API_URL}/api/analyzer/upgrade-path-flip`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`upgrade-path-flip ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as FlipUpgradePathResult;
}
