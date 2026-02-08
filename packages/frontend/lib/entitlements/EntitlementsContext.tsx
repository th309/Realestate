'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  EntitlementsContextValue,
  EntitlementsState,
  UserTier,
  ResourceType,
  AccessInfo
} from './types';
import { fetchEntitlements, trackPaywallEvent } from './api';
import { getAllMetricIds } from '@/lib/data';

const defaultState: EntitlementsState = {
  tier: 'free',
  access: {},
  trial: null,
  loading: true,
  error: null,
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

// Geography levels and features to check
const GEO_LEVELS = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];
const FEATURES = ['analytics_assistant', 'export_csv', 'reports', 'ai_insights', 'scores'];

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
  const [state, setState] = useState<EntitlementsState>(defaultState);
  const [simulatedTier, setSimulatedTier] = useState<UserTier | null>(null);
  const [simulatedAuth, setSimulatedAuth] = useState<boolean | null>(null);

  // Auto-generate resource list from registry if not provided
  const resources = useMemo(
    () => initialResources ?? buildResourceList(),
    [initialResources]
  );

  // Check URL for tier override (dev mode)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get('tier') as UserTier | null;
      if (tierParam && ['free', 'pro', 'enterprise', 'admin'].includes(tierParam)) {
        setSimulatedTier(tierParam);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchEntitlements(resources, simulatedTier);
      setState(data);
    } catch (error) {
      // Fail open: default to free tier on API failure
      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
      }));
    }
  }, [resources, simulatedTier]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    const access = getAccess('metric', metricId);
    return access.level === 'none';
  }, [getAccess]);

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
    refresh();
  }, [refresh]);

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
    simulatedAuth,
    resetSimulation,
    refresh,
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
