// packages/frontend/lib/entitlements/api.ts

import type { EntitlementsState, ResourceType } from './types';
import { getAnonymousSessionId } from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchEntitlements(
  resources: string[],
  tierOverride?: string | null,
  userId?: string | null,
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) {
    headers['x-user-id'] = userId;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    // Network error (backend unreachable) — fail open with free tier defaults
    console.warn('[Entitlements] Backend unreachable, defaulting to free tier');
    return {
      tier: 'free',
      access: {},
      trial: null,
      loading: false,
      error: null,
    };
  }

  if (!response.ok) {
    console.warn('[Entitlements] API returned', response.status, '- defaulting to free tier');
    return {
      tier: 'free',
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
        'x-session-id': getAnonymousSessionId(),
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
