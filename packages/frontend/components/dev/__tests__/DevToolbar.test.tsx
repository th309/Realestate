import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DevToolbar } from '../DevToolbar';

const mockSetSimulatedTier = vi.fn();
const mockSetSimulatedAuth = vi.fn();
const mockResetSimulation = vi.fn();
const mockGetAccess = vi.fn();

const defaultContext = {
  tier: 'free' as const,
  access: {
    'metric:home_value': { level: 'full' as const },
    'feature:scores': { level: 'none' as const, tierRequired: 'pro' as const },
    'metric:cap_rate': { level: 'preview' as const, limit: 6 },
  },
  trial: null,
  loading: false,
  error: null,
  simulatedTier: null,
  setSimulatedTier: mockSetSimulatedTier,
  simulatedAuth: null,
  setSimulatedAuth: mockSetSimulatedAuth,
  resetSimulation: mockResetSimulation,
  getAccess: mockGetAccess,
  canAccess: vi.fn(),
  getPreviewLimit: vi.fn(),
  getTierRequired: vi.fn(),
  isMetricGated: vi.fn(),
  trackPaywallView: vi.fn(),
  trackUpgradeClick: vi.fn(),
  trackDismiss: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('@/lib/entitlements', () => ({
  useEntitlements: () => defaultContext,
}));

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('DevToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.clear();
    // Default: development mode
    vi.stubEnv('NODE_ENV', 'development');
  });

  describe('activation', () => {
    it('renders in development mode', () => {
      render(<DevToolbar />);
      expect(screen.getByTestId('dev-toolbar')).toBeInTheDocument();
    });

    it('renders when sessionStorage flag is set', () => {
      vi.stubEnv('NODE_ENV', 'production');
      sessionStorageMock.getItem.mockReturnValue('true');

      render(<DevToolbar />);
      expect(screen.getByTestId('dev-toolbar')).toBeInTheDocument();
    });

    it('does not render in production without activation', () => {
      vi.stubEnv('NODE_ENV', 'production');
      sessionStorageMock.getItem.mockReturnValue(null);

      render(<DevToolbar />);
      expect(screen.queryByTestId('dev-toolbar')).not.toBeInTheDocument();
    });
  });

  describe('bottom bar', () => {
    it('shows tier badge with current tier', () => {
      render(<DevToolbar />);
      const badge = screen.getByTestId('tier-badge');
      expect(badge).toHaveTextContent('free');
    });

    it('cycles tier on badge click', () => {
      render(<DevToolbar />);
      const badge = screen.getByTestId('tier-badge');
      fireEvent.click(badge);
      // free -> pro
      expect(mockSetSimulatedTier).toHaveBeenCalledWith('pro');
    });

    it('shows auth status as Real Auth when no simulation', () => {
      render(<DevToolbar />);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Real Auth');
    });

    it('shows expand toggle', () => {
      render(<DevToolbar />);
      expect(screen.getByTestId('expand-toggle')).toBeInTheDocument();
    });
  });

  describe('expanded panel', () => {
    it('shows simulation controls when expanded', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));

      expect(screen.getByTestId('tier-btn-free')).toBeInTheDocument();
      expect(screen.getByTestId('tier-btn-pro')).toBeInTheDocument();
      expect(screen.getByTestId('tier-btn-enterprise')).toBeInTheDocument();
      expect(screen.getByTestId('tier-btn-admin')).toBeInTheDocument();
    });

    it('calls setSimulatedTier when tier button clicked', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));
      fireEvent.click(screen.getByTestId('tier-btn-pro'));

      expect(mockSetSimulatedTier).toHaveBeenCalledWith('pro');
    });

    it('shows auth toggle buttons', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));

      expect(screen.getByTestId('auth-btn-anon')).toBeInTheDocument();
      expect(screen.getByTestId('auth-btn-authed')).toBeInTheDocument();
    });

    it('calls setSimulatedAuth when auth button clicked', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));
      fireEvent.click(screen.getByTestId('auth-btn-anon'));

      expect(mockSetSimulatedAuth).toHaveBeenCalledWith(false);
    });

    it('calls resetSimulation when reset button clicked', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));
      fireEvent.click(screen.getByTestId('reset-btn'));

      expect(mockResetSimulation).toHaveBeenCalled();
    });

    it('shows admin page links', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Tiers')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Trial')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('shows resource checker input', () => {
      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));

      expect(screen.getByTestId('resource-checker-input')).toBeInTheDocument();
    });

    it('shows resource checker result when valid input entered', () => {
      mockGetAccess.mockReturnValue({ level: 'none', tierRequired: 'pro' });

      render(<DevToolbar />);
      fireEvent.click(screen.getByTestId('expand-toggle'));

      const input = screen.getByTestId('resource-checker-input');
      fireEvent.change(input, { target: { value: 'feature:scores' } });

      expect(screen.getByTestId('resource-checker-result')).toBeInTheDocument();
    });
  });

  describe('collapse', () => {
    it('hides expanded panel when toggle clicked again', () => {
      render(<DevToolbar />);
      const toggle = screen.getByTestId('expand-toggle');

      // Expand
      fireEvent.click(toggle);
      expect(screen.getByTestId('tier-btn-free')).toBeInTheDocument();

      // Collapse
      fireEvent.click(toggle);
      expect(screen.queryByTestId('tier-btn-free')).not.toBeInTheDocument();
    });
  });
});
