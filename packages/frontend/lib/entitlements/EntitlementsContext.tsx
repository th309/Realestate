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

const defaultState: EntitlementsState = {
  tier: 'free',
  access: {},
  trial: null,
  loading: true,
  error: null,
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

// Resources to pre-fetch on mount
const DEFAULT_RESOURCES = [
  'feature:analytics_assistant',
  'feature:export_csv',
  'feature:reports',
  'geo:zip',
  'geo:county',
];

interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialResources?: string[];
}

export function EntitlementsProvider({
  children,
  initialResources = DEFAULT_RESOURCES
}: EntitlementsProviderProps) {
  const [state, setState] = useState<EntitlementsState>(defaultState);
  const [simulatedTier, setSimulatedTier] = useState<UserTier | null>(null);

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
      const data = await fetchEntitlements(initialResources, simulatedTier);
      setState(data);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [initialResources, simulatedTier]);

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

  const trackPaywallView = useCallback((type: ResourceType, id: string, pagePath?: string) => {
    trackPaywallEvent(type, id, 'view', pagePath || window.location.pathname);
  }, []);

  const trackUpgradeClick = useCallback((type: ResourceType, id: string, pagePath?: string) => {
    trackPaywallEvent(type, id, 'click_upgrade', pagePath || window.location.pathname);
  }, []);

  const trackDismiss = useCallback((type: ResourceType, id: string) => {
    trackPaywallEvent(type, id, 'dismiss', window.location.pathname);
  }, []);

  const value = useMemo<EntitlementsContextValue>(() => ({
    ...state,
    canAccess,
    getAccess,
    getPreviewLimit,
    getTierRequired,
    trackPaywallView,
    trackUpgradeClick,
    trackDismiss,
    simulatedTier,
    setSimulatedTier,
    refresh,
  }), [
    state,
    canAccess,
    getAccess,
    getPreviewLimit,
    getTierRequired,
    trackPaywallView,
    trackUpgradeClick,
    trackDismiss,
    simulatedTier,
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
