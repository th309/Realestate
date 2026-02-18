const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function startCheckout(
  tier: string,
  interval: 'month' | 'year',
  returnContext?: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tier, interval, returnContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Checkout failed' }));
    throw new Error(err.message || 'Failed to create checkout session');
  }

  const data = await res.json();
  return data.checkoutUrl;
}

export async function getBillingPortalUrl(): Promise<string> {
  const res = await fetch(`${API_URL}/api/billing/portal`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to get billing portal URL');
  }

  const data = await res.json();
  return data.portalUrl;
}
