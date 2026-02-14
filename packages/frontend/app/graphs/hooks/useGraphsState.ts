'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { MyMarket } from './useMyMarkets';

export type TemplateType = 'affordability' | 'investment' | 'momentum' | 'cashflow' | 'custom';
export type VizType = 'scatter' | 'heatmap' | 'trend';
export type UserType = 'homebuyer' | 'investor';

interface GraphsState {
  // Markets being compared
  primaryMarket: MyMarket | null;
  comparisonMarket: MyMarket | null;

  // Active template
  activeTemplate: TemplateType;

  // D3 visualization type
  vizType: VizType;

  // Active metric for custom exploration
  activeMetric: string;

  // User type (affects score display)
  userType: UserType;
}

interface UseGraphsStateReturn extends GraphsState {
  // Setters
  setPrimaryMarket: (market: MyMarket | null) => void;
  setComparisonMarket: (market: MyMarket | null) => void;
  setActiveTemplate: (template: TemplateType) => void;
  setVizType: (viz: VizType) => void;
  setActiveMetric: (metric: string) => void;
  setUserType: (type: UserType) => void;

  // Actions
  selectMarket: (market: MyMarket) => void;
  clearComparison: () => void;
  swapMarkets: () => void;
}

const DEFAULT_STATE: GraphsState = {
  primaryMarket: null,
  comparisonMarket: null,
  activeTemplate: 'affordability',
  vizType: 'scatter',
  activeMetric: 'zhvi',
  userType: 'homebuyer',
};

/**
 * Central state management for graphs page with URL sync
 */
export function useGraphsState(): UseGraphsStateReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL params
  const [state, setState] = useState<GraphsState>(() => {
    const template = searchParams.get('template') as TemplateType | null;
    const viz = searchParams.get('viz') as VizType | null;
    const metric = searchParams.get('metric');
    const userType = searchParams.get('user') as UserType | null;

    return {
      ...DEFAULT_STATE,
      activeTemplate: template || DEFAULT_STATE.activeTemplate,
      vizType: viz || DEFAULT_STATE.vizType,
      activeMetric: metric || DEFAULT_STATE.activeMetric,
      userType: userType || DEFAULT_STATE.userType,
    };
  });

  // Sync state to URL
  const syncToUrl = useCallback((newState: Partial<GraphsState>) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newState.primaryMarket !== undefined) {
      if (newState.primaryMarket) {
        params.set('primary', newState.primaryMarket.id);
      } else {
        params.delete('primary');
      }
    }

    if (newState.comparisonMarket !== undefined) {
      if (newState.comparisonMarket) {
        params.set('compare', newState.comparisonMarket.id);
      } else {
        params.delete('compare');
      }
    }

    if (newState.activeTemplate) {
      params.set('template', newState.activeTemplate);
    }

    if (newState.vizType) {
      params.set('viz', newState.vizType);
    }

    if (newState.activeMetric) {
      params.set('metric', newState.activeMetric);
    }

    if (newState.userType) {
      params.set('user', newState.userType);
    }

    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  // Setters with URL sync
  const setPrimaryMarket = useCallback((market: MyMarket | null) => {
    setState(prev => ({ ...prev, primaryMarket: market }));
    syncToUrl({ primaryMarket: market });
  }, [syncToUrl]);

  const setComparisonMarket = useCallback((market: MyMarket | null) => {
    setState(prev => ({ ...prev, comparisonMarket: market }));
    syncToUrl({ comparisonMarket: market });
  }, [syncToUrl]);

  const setActiveTemplate = useCallback((template: TemplateType) => {
    setState(prev => ({ ...prev, activeTemplate: template }));
    syncToUrl({ activeTemplate: template });
  }, [syncToUrl]);

  const setVizType = useCallback((viz: VizType) => {
    setState(prev => ({ ...prev, vizType: viz }));
    syncToUrl({ vizType: viz });
  }, [syncToUrl]);

  const setActiveMetric = useCallback((metric: string) => {
    setState(prev => ({ ...prev, activeMetric: metric }));
    syncToUrl({ activeMetric: metric });
  }, [syncToUrl]);

  const setUserType = useCallback((type: UserType) => {
    setState(prev => ({ ...prev, userType: type }));
    syncToUrl({ userType: type });
  }, [syncToUrl]);

  // Smart market selection: fills primary first, then comparison
  const selectMarket = useCallback((market: MyMarket) => {
    setState(prev => {
      // If clicking already selected market, deselect
      if (prev.primaryMarket?.id === market.id) {
        syncToUrl({ primaryMarket: null });
        return { ...prev, primaryMarket: prev.comparisonMarket, comparisonMarket: null };
      }
      if (prev.comparisonMarket?.id === market.id) {
        syncToUrl({ comparisonMarket: null });
        return { ...prev, comparisonMarket: null };
      }

      // If no primary, set primary
      if (!prev.primaryMarket) {
        syncToUrl({ primaryMarket: market });
        return { ...prev, primaryMarket: market };
      }

      // If no comparison, set comparison
      if (!prev.comparisonMarket) {
        syncToUrl({ comparisonMarket: market });
        return { ...prev, comparisonMarket: market };
      }

      // Both filled: replace comparison
      syncToUrl({ comparisonMarket: market });
      return { ...prev, comparisonMarket: market };
    });
  }, [syncToUrl]);

  const clearComparison = useCallback(() => {
    setState(prev => ({ ...prev, primaryMarket: null, comparisonMarket: null }));
    syncToUrl({ primaryMarket: null, comparisonMarket: null });
  }, [syncToUrl]);

  const swapMarkets = useCallback(() => {
    setState(prev => {
      const swapped = {
        primaryMarket: prev.comparisonMarket,
        comparisonMarket: prev.primaryMarket,
      };
      syncToUrl(swapped);
      return { ...prev, ...swapped };
    });
  }, [syncToUrl]);

  return {
    ...state,
    setPrimaryMarket,
    setComparisonMarket,
    setActiveTemplate,
    setVizType,
    setActiveMetric,
    setUserType,
    selectMarket,
    clearComparison,
    swapMarkets,
  };
}

export default useGraphsState;
