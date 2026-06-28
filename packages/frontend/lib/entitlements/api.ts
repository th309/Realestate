// packages/frontend/lib/entitlements/api.ts

import type { EntitlementsState, ResourceType } from "./types";
import { getAnonymousSessionId } from "./session";
import { getAuthHeaders } from "@/lib/data/fetchers/auth-headers";
// Same-origin in the browser (→ `/backend`) so ad blockers don't block it.
import { API_URL } from "@/lib/data/fetchers/api-url";

export async function fetchEntitlements(
  resources: string[],
  tierOverride?: string | null,
  userId?: string | null,
  signal?: AbortSignal,
): Promise<EntitlementsState> {
  const params = new URLSearchParams();
  if (resources.length > 0) {
    params.set("resources", resources.join(","));
  }
  if (tierOverride) {
    params.set("tier", tierOverride);
  }
  // No `_t` cache-buster: callers go through React Query, which de-duplicates by
  // a stable query key. A per-call timestamp made every URL unique and defeated
  // that dedup — the bug that produced bursts of identical entitlement checks.
  // Freshness is enforced by `cache: "no-store"` below + React Query's staleTime.

  const url = `${API_URL}/api/entitlements/check?${params}`;

  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    "Content-Type": "application/json",
  };
  if (userId) {
    headers["x-user-id"] = userId;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch (err) {
    // Let a native AbortError (HMR rebuild, navigation, unmount, or a request
    // superseded by React Query's `signal`) propagate UNWRAPPED. React Query v5
    // treats an error named "AbortError" as a benign cancellation and keeps the
    // prior query state; wrapping it in a plain Error would instead strand the
    // query in `error` state (retry is disabled).
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    // Network error (backend genuinely unreachable) — throw so the caller preserves previous tier
    console.warn("[Entitlements] Backend unreachable:", err);
    throw new Error("Backend unreachable");
  }

  if (!response.ok) {
    console.warn("[Entitlements] API returned", response.status);
    throw new Error(`Entitlements API returned ${response.status}`);
  }

  const data = await response.json();

  return {
    tier: data.tier,
    access: data.access,
    trial: data.trial,
    loading: false,
    error: null,
  };
}

// Backoff schedule (ms) between retries on transient cold-load failures.
// 3 retries → ~3.9s total worst-case before the caller settles on prior state.
const ENTITLEMENT_RETRY_DELAYS_MS = [400, 1000, 2500];

/**
 * An aborted request (HMR rebuild, navigation, unmount, or a React-Query-
 * superseded fetch) is intentional, not a failure — the native AbortError
 * propagates unwrapped. Those must NOT be retried; only genuine transient
 * errors ("Backend unreachable" or a non-ok 5xx) self-heal via retry.
 */
export function isAbortedEntitlementsError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Wraps `fetchEntitlements` with bounded retry + backoff so a single transient
 * blip right after cold load / login (proxy not yet warm, cookie not yet
 * propagated, a flaky 5xx) does not strand an authenticated Pro/trial user on
 * the `free` default for up to the 30-minute refresh interval.
 *
 * Fail-open is NOT performed here: on exhaustion the final error is re-thrown so
 * the caller preserves its prior state. Aborts are never retried.
 */
export async function fetchEntitlementsWithRetry(
  resources: string[],
  tierOverride?: string | null,
  userId?: string | null,
  signal?: AbortSignal,
): Promise<EntitlementsState> {
  let lastError: unknown;
  // 1 initial attempt + ENTITLEMENT_RETRY_DELAYS_MS.length retries.
  for (
    let attempt = 0;
    attempt <= ENTITLEMENT_RETRY_DELAYS_MS.length;
    attempt++
  ) {
    try {
      return await fetchEntitlements(resources, tierOverride, userId, signal);
    } catch (error) {
      lastError = error;
      // Aborts are intentional (unmount / navigation / HMR) — do not retry.
      if (isAbortedEntitlementsError(error)) {
        throw error;
      }
      const delay = ENTITLEMENT_RETRY_DELAYS_MS[attempt];
      // No delay slot left means we've exhausted retries; re-throw below.
      if (delay === undefined) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function trackPaywallEvent(
  resourceType: ResourceType,
  resourceId: string,
  eventType: "view" | "click_upgrade" | "dismiss",
  pagePath?: string,
  userId?: string,
  userTier?: string,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-session-id": getAnonymousSessionId(),
    };
    if (userId) headers["x-user-id"] = userId;
    if (userTier) headers["x-user-tier"] = userTier;

    await fetch(`${API_URL}/api/entitlements/events`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({
        resourceType,
        resourceId,
        eventType,
        pagePath,
      }),
    });
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.warn("Failed to track paywall event:", error);
  }
}

/** Fetch usage count for a feature */
export async function fetchFeatureUsage(
  featureSlug: string,
  userId: string,
): Promise<{ usage_count: number }> {
  // TODO: Wire to real endpoint when user auth is in place
  // For now, return 0 to not block any usage
  return { usage_count: 0 };
}

/** Increment usage count for a feature */
export async function incrementFeatureUsage(
  featureSlug: string,
  userId: string,
): Promise<{ success: boolean; new_count: number }> {
  // TODO: Wire to real endpoint when user auth is in place
  return { success: true, new_count: 0 };
}
