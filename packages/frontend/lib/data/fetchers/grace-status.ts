/**
 * ENTERPRISE GRACE PERIOD FETCHERS
 *
 * API functions for checking enterprise grace period status
 * and initiating billing setup via Stripe.
 */

import { fetchAPI, fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraceStatus {
  hasGracePeriod: boolean;
  expiresAt: string | null;
  daysRemaining: number;
  hasBilling: boolean;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's enterprise grace period status.
 * Returns whether they have an active grace period and billing info.
 */
export async function fetchGraceStatus(): Promise<GraceStatus> {
  return fetchAPI<GraceStatus>("/api/entitlements/grace-status");
}

/**
 * Initiate Stripe checkout for enterprise billing setup.
 * Returns a checkout URL to redirect the user to.
 */
export async function setupEnterpriseBilling(): Promise<{
  checkout_url: string;
}> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/entitlements/setup-billing", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: "Failed to create billing session" }));
    throw new Error(err.message || "Failed to create billing session");
  }

  return res.json();
}
