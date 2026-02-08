import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMetricAccess } from '../useMetricAccess';

// Mock useEntitlements
const mockGetAccess = vi.fn();

vi.mock('@/lib/entitlements', () => ({
  useEntitlements: () => ({
    getAccess: mockGetAccess,
  }),
}));

describe('useMetricAccess', () => {
  it('returns gated=true when access level is none', () => {
    mockGetAccess.mockReturnValue({ level: 'none', tierRequired: 'pro' });

    const { result } = renderHook(() => useMetricAccess('cap_rate'));

    expect(result.current.gated).toBe(true);
    expect(result.current.preview).toBe(false);
    expect(result.current.previewLimit).toBeNull();
    expect(result.current.tierRequired).toBe('pro');
  });

  it('returns preview=true with limit when access level is preview', () => {
    mockGetAccess.mockReturnValue({ level: 'preview', limit: 12, tierRequired: 'pro' });

    const { result } = renderHook(() => useMetricAccess('home_value'));

    expect(result.current.gated).toBe(false);
    expect(result.current.preview).toBe(true);
    expect(result.current.previewLimit).toBe(12);
    expect(result.current.tierRequired).toBe('pro');
  });

  it('returns gated=false and preview=false when access is full', () => {
    mockGetAccess.mockReturnValue({ level: 'full' });

    const { result } = renderHook(() => useMetricAccess('home_value'));

    expect(result.current.gated).toBe(false);
    expect(result.current.preview).toBe(false);
    expect(result.current.previewLimit).toBeNull();
    expect(result.current.tierRequired).toBeNull();
  });

  it('passes metric id to getAccess with type metric', () => {
    mockGetAccess.mockReturnValue({ level: 'full' });

    renderHook(() => useMetricAccess('rent_index'));

    expect(mockGetAccess).toHaveBeenCalledWith('metric', 'rent_index');
  });

  it('returns null previewLimit when preview has no limit set', () => {
    mockGetAccess.mockReturnValue({ level: 'preview' });

    const { result } = renderHook(() => useMetricAccess('home_value'));

    expect(result.current.preview).toBe(true);
    expect(result.current.previewLimit).toBeNull();
  });
});
