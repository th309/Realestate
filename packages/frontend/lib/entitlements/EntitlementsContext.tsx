'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  EntitlementsContextValue,
  EntitlementsState,
  UserTier,
  ResourceType,
  AccessInfo,
  FeatureUsage,
} from './types';
import { fetchEntitlements, trackPaywallEvent } from './api';
import { useAuth } from '@/lib/auth';
import { getAllMetricIds } from '@/lib/data';

const defaultState: EntitlementsState = {
  tier: 'free',
  access: {},
  trial: null,
  loading: true,
  error: null,
};

// Session storage keys for dev toolbar persistence
const STORAGE_KEYS = {
  SIMULATED_TIER: 'devtools-simulated-tier',
  SIMULATED_AUTH: 'devtools-simulated-auth',
} as const;

/** Read simulated tier from sessionStorage */
function getStoredSimulatedTier(): UserTier | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(STORAGE_KEYS.SIMULATED_TIER);
  if (stored && ['free', 'pro', 'enterprise', 'admin'].includes(stored)) {
    return stored as UserTier;
  }
  return null;
}

/** Read simulated auth from sessionStorage */
function getStoredSimulatedAuth(): boolean | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(STORAGE_KEYS.SIMULATED_AUTH);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return null;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

// Geography levels and features to check
const GEO_LEVELS = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];
const FEATURES = [
  'analytics_assistant', 'export_csv', 'reports', 'ai_insights',
  'score_breakdown',
  'reports_monthly', 'ai_analysis_monthly', 'history_months',
  'weekly_digest', 'benchmarking', 'recommendations',
];

/** Build full resource list from metric registry + geo levels + features */
function buildResourceList(): string[] {
  return [
    ...getAllMetricIds().map(id => `metric:${id}`),
    ...GEO_LEVELS.map(g => `geo:${g}`),
    ...FEATURES.map(f => `feature:${f}`),
  ];
}

interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialResources?: string[];
}

export function EntitlementsProvider({
  children,
  initialResources,
}: EntitlementsProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<EntitlementsState>(defaultState);
  // Initialize from sessionStorage to persist across navigations
  const [simulatedTier, setSimulatedTierRaw] = useState<UserTier | null>(() => getStoredSimulatedTier());
  const [simulatedAuth, setSimulatedAuthRaw] = useState<boolean | null>(() => getStoredSimulatedAuth());

  const [usageCache, setUsageCache] = useState<Record<string, number>>({});

  // Use ref to track the latest simulatedTier for the refresh callback
  const simulatedTierRef = useRef<UserTier | null>(simulatedTier);

  // Wrap setSimulatedTier to persist to sessionStorage
  const setSimulatedTier = useCallback((tier: UserTier | null) => {
    setSimulatedTierRaw(tier);
    simulatedTierRef.current = tier;
    if (tier) {
      sessionStorage.setItem(STORAGE_KEYS.SIMULATED_TIER, tier);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.SIMULATED_TIER);
    }
  }, []);

  // Wrap setSimulatedAuth to persist to sessionStorage
  const setSimulatedAuth = useCallback((auth: boolean | null) => {
    setSimulatedAuthRaw(auth);
    if (auth !== null) {
      sessionStorage.setItem(STORAGE_KEYS.SIMULATED_AUTH, String(auth));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.SIMULATED_AUTH);
    }
  }, []);

  // Auto-generate resource list from registry if not provided
  const resources = useMemo(
    () => initialResources ?? buildResourceList(),
    [initialResources]
  );

  // Check URL for tier override (dev mode) - only on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get('tier') as UserTier | null;
      if (tierParam && ['free', 'pro', 'enterprise', 'admin'].includes(tierParam)) {
        setSimulatedTier(tierParam);
      }
    }
  }, [setSimulatedTier]);

  // Clear simulated tier when the authenticated user changes.
  // This prevents stale dev-tools overrides from leaking across sign-in/sign-out cycles
  // (sessionStorage persists within the same tab even after re-authentication).
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    // Only clear on actual user transitions (not initial mount)
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentUserId) {
      if (simulatedTierRef.current) {
        setSimulatedTier(null);
        setSimulatedAuth(null);
      }
    }
    prevUserIdRef.current = currentUserId ?? undefined;
  }, [user?.id, setSimulatedTier, setSimulatedAuth]);

  // Track user ID in ref to avoid stale closures
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    // Use ref to get the latest simulated tier (avoids stale closure issues)
    const currentTier = simulatedTierRef.current;
    const currentUserId = userIdRef.current;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchEntitlements(resources, currentTier, currentUserId);
      setState(data);
    } catch (error) {
      // Fail open: default to free tier on API failure
      console.error('[Entitlements] fetch error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
      }));
    }
  }, [resources]); // Remove simulatedTier from deps - we use the ref instead

  // Refresh when simulatedTier or user changes, but only after auth resolves
  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [simulatedTier, user?.id, authLoading, refresh]);

  const canAccess = useCallback((type: ResourceType, id: string): boolean => {
    const key = `${type}:${id}`;
    const accessInfo = state.access[key];
    return accessInfo?.level === 'full' || accessInfo?.level === 'preview';
  }, [state.access]);

  const getAccess = useCallback((type: ResourceType, id: string): AccessInfo => {
    const key = `${type}:${id}`;
    return state.access[key] || { level: 'none', tierRequired: 'pro' };
  }, [state.access]);

  const getPreviewLimit = useCallback((type: ResourceType, id: string): number | null => {
    const key = `${type}:${id}`;
    const accessInfo = state.access[key];
    return accessInfo?.level === 'preview' ? (accessInfo.limit ?? null) : null;
  }, [state.access]);

  const getTierRequired = useCallback((type: ResourceType, id: string): UserTier | null => {
    const key = `${type}:${id}`;
    const accessInfo = state.access[key];
    return accessInfo?.tierRequired ?? null;
  }, [state.access]);

  const isMetricGated = useCallback((metricId: string): boolean => {
    // While loading, assume unlocked to prevent showing stale lock states during tier transitions
    if (state.loading) {
      return false;
    }
    const access = getAccess('metric', metricId);
    return access.level === 'none';
  }, [state.loading, getAccess]);

  // TTL: re-fetch entitlements every 30 minutes
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
    const interval = setInterval(() => { refresh(); }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const trackPaywallView = useCallback((type: ResourceType, id: string, pagePath?: string) => {
    trackPaywallEvent(type, id, 'view', pagePath || window.location.pathname);
  }, []);

  const trackUpgradeClick = useCallback((type: ResourceType, id: string, pagePath?: string) => {
    trackPaywallEvent(type, id, 'click_upgrade', pagePath || window.location.pathname);
  }, []);

  const trackDismiss = useCallback((type: ResourceType, id: string) => {
    trackPaywallEvent(type, id, 'dismiss', window.location.pathname);
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulatedTier(null);
    setSimulatedAuth(null);
    // Note: refresh will be triggered by the simulatedTier useEffect
  }, [setSimulatedTier, setSimulatedAuth]);

  const getUsage = useCallback((featureSlug: string): FeatureUsage | null => {
    // Check if there's a numeric limit for this feature in the access map
    // Preview features are stored as feature:<slug> in the access map
    const key = `feature:${featureSlug}`;
    const accessInfo = state.access[key];
    const limit = accessInfo?.limit ?? null;

    if (limit === null) return null;
    if (limit === -1) return { feature_slug: featureSlug, usage_count: 0, limit: -1, remaining: -1 };

    const count = usageCache[featureSlug] || 0;
    return {
      feature_slug: featureSlug,
      usage_count: count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  }, [state.access, usageCache]);

  const incrementUsage = useCallback(async (featureSlug: string): Promise<boolean> => {
    const usage = getUsage(featureSlug);
    if (!usage) return true; // No limit configured
    if (usage.limit === -1) return true; // Unlimited
    if (usage.remaining <= 0) return false; // At limit

    setUsageCache(prev => ({
      ...prev,
      [featureSlug]: (prev[featureSlug] || 0) + 1,
    }));
    return true;
  }, [getUsage]);

  const value = useMemo<EntitlementsContextValue>(() => ({
    ...state,
    canAccess,
    getAccess,
    getPreviewLimit,
    getTierRequired,
    isMetricGated,
    trackPaywallView,
    trackUpgradeClick,
    trackDismiss,
    simulatedTier,
    setSimulatedTier,
    simulatedAuth,
    setSimulatedAuth,
    resetSimulation,
    refresh,
    getUsage,
    incrementUsage,
  }), [
    state,
    canAccess,
    getAccess,
    getPreviewLimit,
    getTierRequired,
    isMetricGated,
    trackPaywallView,
    trackUpgradeClick,
    trackDismiss,
    simulatedTier,
    setSimulatedTier,
    simulatedAuth,
    setSimulatedAuth,
    resetSimulation,
    refresh,
    getUsage,
    incrementUsage,
  ]);

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsContextValue {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }
  return context;
}
