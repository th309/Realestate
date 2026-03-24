/**
 * ORGANIZATION BILLING FETCHERS
 *
 * API functions for org-level billing: usage, checkout, portal, and seat management.
 */

import { fetchAPI, fetchAPIRaw } from "./base";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgBillingUsage {
  seats_used: number;
  seats_included: number;
  additional_seats: number;
  current_period_start: string;
  current_period_end: string;
  plan_name: string;
  status: string;
}

export interface OrgCheckoutResult {
  checkout_url: string;
}

export interface OrgBillingPortalResult {
  portal_url: string;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch billing usage summary for an organization.
 */
export async function fetchOrgBilling(slug: string): Promise<OrgBillingUsage> {
  return fetchAPI<OrgBillingUsage>(`/api/org/${slug}/billing/usage`);
}

/**
 * Create a Stripe checkout session for a new organization subscription.
 */
export async function createOrgCheckout(
  name: string,
  slug: string,
): Promise<OrgCheckoutResult> {
  const res = await fetchAPIRaw("/api/org/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Checkout failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Create a Stripe billing portal session for the organization.
 */
export async function createOrgBillingPortal(
  slug: string,
): Promise<OrgBillingPortalResult> {
  const res = await fetchAPIRaw(`/api/org/${slug}/billing/portal`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Billing portal failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Update the number of additional seats for the organization.
 */
export async function updateOrgSeats(
  slug: string,
  additionalSeats: number,
): Promise<void> {
  const res = await fetchAPIRaw(`/api/org/${slug}/billing/seats`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ additional_seats: additionalSeats }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Seats update failed: ${res.status}`);
  }
}
