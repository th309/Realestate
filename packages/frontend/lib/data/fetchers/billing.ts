/**
 * BILLING DATA FETCHERS
 *
 * API functions for Stripe checkout and billing portal access.
 */

import { fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Start a Stripe checkout session and return the checkout URL.
 */
export async function startCheckout(
  tier: string,
  interval: "month" | "year",
  returnContext?: string,
): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/billing/checkout", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ tier, interval, returnContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Checkout failed" }));
    throw new Error(err.message || "Failed to create checkout session");
  }

  const data = await res.json();
  return data.checkoutUrl;
}

/**
 * Get the Stripe billing portal URL for the current user.
 */
export async function getBillingPortalUrl(): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/billing/portal", {
    headers: authHeaders,
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: "Failed to get billing portal URL" }));
    throw new Error(err.message || "Failed to get billing portal URL");
  }

  const data = await res.json();
  return data.portalUrl;
}

// ---------------------------------------------------------------------------
// Subscription status
// ---------------------------------------------------------------------------

export interface SubscriptionStatus {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

/**
 * Fetch the current subscription status including pending cancellation info.
 */
export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/billing/subscription-status", {
    headers: authHeaders,
  });

  if (!res.ok) {
    throw new Error("Failed to fetch subscription status");
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Cancel / Resume
// ---------------------------------------------------------------------------

export interface CancelSubscriptionResult {
  cancelAt: string;
  currentPeriodEnd: string;
}

/**
 * Cancel the current subscription at the end of the billing period.
 * The user retains access until `currentPeriodEnd`.
 */
export async function cancelSubscription(): Promise<CancelSubscriptionResult> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/billing/cancel", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: "Cancellation failed" }));
    throw new Error(err.message || "Failed to cancel subscription");
  }

  return res.json();
}

/**
 * Resume a subscription that was scheduled for cancellation.
 */
export async function resumeSubscription(): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/billing/resume", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Resume failed" }));
    throw new Error(err.message || "Failed to resume subscription");
  }
}
