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

  const response = await fetch(`${API_URL}/api/entitlements/check?${params}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch entitlements');
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
