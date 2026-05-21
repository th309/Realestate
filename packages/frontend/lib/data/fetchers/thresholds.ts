/**
 * USER THRESHOLDS FETCHERS
 *
 * Per-user grading thresholds keyed by strategy. Three operations:
 * - GET    /api/analyzer/thresholds/:strategy → current saved thresholds (or
 *          server default if the user has never customized them)
 * - PUT    /api/analyzer/thresholds/:strategy → upsert
 * - DELETE /api/analyzer/thresholds/:strategy → reset to system defaults
 *
 * No `/v1` segment by design — these endpoints are stable on the v0 prefix.
 */

import type { Strategy, UserThresholds } from "@propertyiq/analyzer-core";
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

function thresholdsUrl(strategy: Strategy): string {
  return `${API_URL}/api/analyzer/thresholds/${strategy}`;
}

export async function fetchThresholds(
  strategy: Strategy,
): Promise<UserThresholds> {
  const headers = await getAuthHeaders();
  const res = await fetch(thresholdsUrl(strategy), {
    credentials: "include",
    headers: { ...headers },
  });
  if (!res.ok) throw new Error(`fetchThresholds ${res.status}`);
  return (await res.json()) as UserThresholds;
}

export async function updateThresholds(
  strategy: Strategy,
  body: UserThresholds,
): Promise<UserThresholds> {
  const headers = await getAuthHeaders();
  const res = await fetch(thresholdsUrl(strategy), {
    method: "PUT",
    credentials: "include",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`updateThresholds ${res.status}`);
  return (await res.json()) as UserThresholds;
}

export async function deleteThresholds(
  strategy: Strategy,
): Promise<{ ok: true }> {
  const headers = await getAuthHeaders();
  const res = await fetch(thresholdsUrl(strategy), {
    method: "DELETE",
    credentials: "include",
    headers: { ...headers },
  });
  if (!res.ok) throw new Error(`deleteThresholds ${res.status}`);
  return { ok: true };
}
