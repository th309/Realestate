import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEntitlements, trackPaywallEvent } from '../api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchEntitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends resources as comma-separated query param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tier: 'free', access: {}, trial: null }),
    });

    await fetchEntitlements(['metric:home_value', 'feature:scores']);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('resources=metric%3Ahome_value%2Cfeature%3Ascores');
  });

  it('includes tier override in query params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tier: 'pro', access: {}, trial: null }),
    });

    await fetchEntitlements(['metric:home_value'], 'pro');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('tier=pro');
  });

  it('returns parsed entitlements state', async () => {
    const apiResponse = {
      tier: 'pro',
      access: { 'metric:home_value': { level: 'full' } },
      trial: { active: true, daysRemaining: 7, tier: 'pro' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    });

    const result = await fetchEntitlements(['metric:home_value']);

    expect(result.tier).toBe('pro');
    expect(result.access).toEqual({ 'metric:home_value': { level: 'full' } });
    expect(result.trial).toEqual({ active: true, daysRemaining: 7, tier: 'pro' });
    expect(result.loading).toBe(false);
    expect(result.error).toBeNull();
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchEntitlements(['metric:home_value'])).rejects.toThrow(
      'Failed to fetch entitlements'
    );
  });

  it('omits resources param when empty array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tier: 'free', access: {}, trial: null }),
    });

    await fetchEntitlements([]);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('resources=');
  });
});

describe('trackPaywallEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends event via POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await trackPaywallEvent('feature', 'scores', 'view', '/pricing');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/entitlements/events'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          resourceType: 'feature',
          resourceId: 'scores',
          eventType: 'view',
          pagePath: '/pricing',
        }),
      })
    );
  });

  it('does not throw on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    await expect(
      trackPaywallEvent('feature', 'scores', 'click_upgrade', '/map')
    ).resolves.toBeUndefined();
  });
});
