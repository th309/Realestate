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

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    // Network error (backend unreachable) — fail open with free tier defaults
    console.warn('[Entitlements] Backend unreachable, defaulting to free tier');
    return {
      tier: (tierOverride as any) || 'free',
      access: {},
      trial: null,
      loading: false,
      error: null,
    };
  }

  if (!response.ok) {
    console.warn('[Entitlements] API returned', response.status, '- defaulting to free tier');
    return {
      tier: (tierOverride as any) || 'free',
      access: {},
      trial: null,
      loading: false,
      error: null,
    };
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
