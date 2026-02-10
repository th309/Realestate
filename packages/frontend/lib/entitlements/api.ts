// packages/frontend/lib/entitlements/api.ts

import type { EntitlementsState, ResourceType } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchEntitlements(
  resources: string[],
  tierOverride?: string | null,
): Promise<EntitlementsState> {
  const params = new URLSearchParams();
  if (resources.length > 0) {
    params.set('resources', resources.join(','));
  }
  if (tierOverride) {
    params.set('tier', tierOverride);
  }
  // Cache bust to ensure fresh data
  params.set('_t', Date.now().toString());

  const url = `${API_URL}/api/entitlements/check?${params}`;
  console.log('[Entitlements] Fetching:', url.substring(0, 100) + '..., tier=' + tierOverride);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch entitlements');
  }

  const data = await response.json();
  console.log('[Entitlements] Response tier:', data.tier, 'access count:', Object.keys(data.access).length);

  return {
    tier: data.tier,
    access: data.access,
    trial: data.trial,
    loading: false,
    error: null,
  };
}

export async function trackPaywallEvent(
  resourceType: ResourceType,
  resourceId: string,
  eventType: 'view' | 'click_upgrade' | 'dismiss',
  pagePath?: string,
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/entitlements/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        resourceType,
        resourceId,
        eventType,
        pagePath,
      }),
    });
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.warn('Failed to track paywall event:', error);
  }
}
