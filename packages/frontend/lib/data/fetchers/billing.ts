/**
 * BILLING DATA FETCHERS
 *
 * API functions for Stripe checkout and billing portal access.
 */

import { fetchAPIRaw } from './base';
import { getAuthHeaders } from './auth-headers';

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Start a Stripe checkout session and return the checkout URL.
 */
export async function startCheckout(
  tier: string,
  interval: 'month' | 'year',
  returnContext?: string,
): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/billing/checkout', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, interval, returnContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Checkout failed' }));
    throw new Error(err.message || 'Failed to create checkout session');
  }

  const data = await res.json();
  return data.checkoutUrl;
}

/**
 * Get the Stripe billing portal URL for the current user.
 */
export async function getBillingPortalUrl(): Promise<string> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw('/api/billing/portal', { headers: authHeaders });

  if (!res.ok) {
    throw new Error('Failed to get billing portal URL');
  }

  const data = await res.json();
  return data.portalUrl;
}
