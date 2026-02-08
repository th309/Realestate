import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { EntitlementsProvider, useEntitlements } from '../EntitlementsContext';

// Mock the API module
vi.mock('../api', () => ({
  fetchEntitlements: vi.fn(),
  trackPaywallEvent: vi.fn(),
}));

// Mock getAllMetricIds to avoid pulling in the entire registry
vi.mock('@/lib/data', () => ({
  getAllMetricIds: () => ['home_value', 'rent_index', 'cap_rate'],
}));

import { fetchEntitlements } from '../api';

const mockedFetch = vi.mocked(fetchEntitlements);

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <EntitlementsProvider initialResources={['metric:home_value', 'feature:scores']}>
      {children}
    </EntitlementsProvider>
  );
}

describe('EntitlementsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canAccess', () => {
    it('returns true when access level is full', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'pro',
        access: {
          'metric:home_value': { level: 'full' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canAccess('metric', 'home_value')).toBe(true);
    });

    it('returns true when access level is preview', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {
          'metric:home_value': { level: 'preview', limit: 12 },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canAccess('metric', 'home_value')).toBe(true);
    });

    it('returns false when access level is none', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {
          'metric:home_value': { level: 'none', tierRequired: 'pro' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canAccess('metric', 'home_value')).toBe(false);
    });

    it('returns false for unknown resources', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {},
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.canAccess('metric', 'nonexistent')).toBe(false);
    });
  });

  describe('getAccess', () => {
    it('returns access info for known resource', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'pro',
        access: {
          'feature:scores': { level: 'full', tierRequired: 'pro' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      const access = result.current.getAccess('feature', 'scores');
      expect(access.level).toBe('full');
      expect(access.tierRequired).toBe('pro');
    });

    it('defaults to none with pro required for unknown resources', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {},
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      const access = result.current.getAccess('feature', 'unknown_feature');
      expect(access.level).toBe('none');
      expect(access.tierRequired).toBe('pro');
    });
  });

  describe('isMetricGated', () => {
    it('returns true when metric access is none', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {
          'metric:cap_rate': { level: 'none', tierRequired: 'pro' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isMetricGated('cap_rate')).toBe(true);
    });

    it('returns false when metric has full access', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'pro',
        access: {
          'metric:cap_rate': { level: 'full' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isMetricGated('cap_rate')).toBe(false);
    });

    it('returns false when metric has preview access', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {
          'metric:cap_rate': { level: 'preview', limit: 6 },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isMetricGated('cap_rate')).toBe(false);
    });
  });

  describe('getPreviewLimit', () => {
    it('returns limit when access is preview', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {
          'metric:home_value': { level: 'preview', limit: 12 },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getPreviewLimit('metric', 'home_value')).toBe(12);
    });

    it('returns null when access is full', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'pro',
        access: {
          'metric:home_value': { level: 'full' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getPreviewLimit('metric', 'home_value')).toBeNull();
    });
  });

  describe('getTierRequired', () => {
    it('returns tier required for gated resource', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'free',
        access: {
          'feature:scores': { level: 'none', tierRequired: 'enterprise' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getTierRequired('feature', 'scores')).toBe('enterprise');
    });

    it('returns null when no tier required specified', async () => {
      mockedFetch.mockResolvedValueOnce({
        tier: 'pro',
        access: {
          'feature:scores': { level: 'full' },
        },
        trial: null,
        loading: false,
        error: null,
      });

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.getTierRequired('feature', 'scores')).toBeNull();
    });
  });

  describe('fail-open behavior', () => {
    it('defaults to free tier and remains functional on API failure', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useEntitlements(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should not throw, should remain on free tier
      expect(result.current.tier).toBe('free');
      expect(result.current.error).toBeNull();
    });
  });

  describe('useEntitlements outside provider', () => {
    it('throws when used outside EntitlementsProvider', () => {
      expect(() => {
        renderHook(() => useEntitlements());
      }).toThrow('useEntitlements must be used within an EntitlementsProvider');
    });
  });
});
