import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EntitlementGate } from '../EntitlementGate';

const mockGetAccess = vi.fn();
const mockTrackPaywallView = vi.fn();

vi.mock('@/lib/entitlements', () => ({
  useEntitlements: () => ({
    getAccess: mockGetAccess,
    trackPaywallView: mockTrackPaywallView,
  }),
}));

describe('EntitlementGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders children when access level is full', () => {
    mockGetAccess.mockReturnValue({ level: 'full' });

    render(
      <EntitlementGate type="feature" id="scores">
        <div>Protected Content</div>
      </EntitlementGate>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders fallback when access level is none', () => {
    mockGetAccess.mockReturnValue({ level: 'none', tierRequired: 'pro' });

    render(
      <EntitlementGate
        type="feature"
        id="scores"
        fallback={<div>Upgrade Required</div>}
      >
        <div>Protected Content</div>
      </EntitlementGate>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Upgrade Required')).toBeInTheDocument();
  });

  it('renders children when preview access with showTeaser=true', () => {
    mockGetAccess.mockReturnValue({ level: 'preview', limit: 12 });

    render(
      <EntitlementGate
        type="metric"
        id="home_value"
        showTeaser
        fallback={<div>Upgrade Required</div>}
      >
        <div>Preview Content</div>
      </EntitlementGate>
    );

    expect(screen.getByText('Preview Content')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade Required')).not.toBeInTheDocument();
  });

  it('renders fallback when preview access without showTeaser', () => {
    mockGetAccess.mockReturnValue({ level: 'preview', limit: 12 });

    render(
      <EntitlementGate
        type="metric"
        id="home_value"
        fallback={<div>Upgrade Required</div>}
      >
        <div>Preview Content</div>
      </EntitlementGate>
    );

    expect(screen.queryByText('Preview Content')).not.toBeInTheDocument();
    expect(screen.getByText('Upgrade Required')).toBeInTheDocument();
  });

  it('tracks paywall view when access is none', () => {
    mockGetAccess.mockReturnValue({ level: 'none', tierRequired: 'pro' });

    render(
      <EntitlementGate type="feature" id="reports">
        <div>Content</div>
      </EntitlementGate>
    );

    expect(mockTrackPaywallView).toHaveBeenCalledWith('feature', 'reports');
  });

  it('does not track paywall view when access is full', () => {
    mockGetAccess.mockReturnValue({ level: 'full' });

    render(
      <EntitlementGate type="feature" id="reports">
        <div>Content</div>
      </EntitlementGate>
    );

    expect(mockTrackPaywallView).not.toHaveBeenCalled();
  });
});
